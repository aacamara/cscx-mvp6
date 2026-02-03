/**
 * Onboarding Stall Detection Service (PRD-098)
 *
 * Detects when customer onboarding has stalled and identifies blockers.
 * Implements FR-1.1 through FR-1.6 and FR-2.1 through FR-2.4.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  OnboardingStallCheck,
  StallResult,
  StallIssue,
  StallIssueSeverity,
  StallOwner,
  CustomerSegment,
  OnboardingTask,
  OnboardingUser,
  DEFAULT_STALL_RULES,
  StalledOnboardingCard,
  OnboardingStallDashboard,
} from './types.js';

// Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Constants
// ============================================

// Expected onboarding duration by segment (in days)
const EXPECTED_ONBOARDING_DAYS: Record<CustomerSegment, number> = {
  enterprise: 60,
  'mid-market': 30,
  smb: 14,
};

// Phase expected durations (in days)
const PHASE_DURATIONS: Record<string, Record<CustomerSegment, number>> = {
  kickoff: { enterprise: 7, 'mid-market': 5, smb: 3 },
  technical_setup: { enterprise: 21, 'mid-market': 10, smb: 5 },
  integration: { enterprise: 14, 'mid-market': 7, smb: 3 },
  training: { enterprise: 14, 'mid-market': 7, smb: 3 },
  go_live: { enterprise: 7, 'mid-market': 3, smb: 2 },
};

// Severity escalation thresholds (days past expected)
const SEVERITY_THRESHOLDS = {
  low: 0,
  medium: 3,
  high: 7,
  critical: 14,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate business days between two dates
 */
function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);

  while (current < end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Calculate calendar days between two dates
 */
function daysBetween(start: Date, end: Date): number {
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determine segment from ARR
 */
function getSegmentFromARR(arr: number): CustomerSegment {
  if (arr >= 100000) return 'enterprise';
  if (arr >= 25000) return 'mid-market';
  return 'smb';
}

/**
 * Calculate severity based on days overdue
 */
function calculateSeverity(daysOverdue: number): StallIssueSeverity {
  if (daysOverdue >= SEVERITY_THRESHOLDS.critical) return 'critical';
  if (daysOverdue >= SEVERITY_THRESHOLDS.high) return 'high';
  if (daysOverdue >= SEVERITY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Determine stall owner based on issue type and context
 */
function determineStallOwner(
  issueType: string,
  tasks: OnboardingTask[]
): StallOwner {
  if (issueType === 'no_response' || issueType === 'user_not_activated') {
    return 'customer';
  }

  // Check task ownership
  const customerTasks = tasks.filter(
    (t) => t.status !== 'completed' && t.owner?.toLowerCase().includes('customer')
  );
  const internalTasks = tasks.filter(
    (t) => t.status !== 'completed' && !t.owner?.toLowerCase().includes('customer')
  );

  if (customerTasks.length > internalTasks.length) return 'customer';
  if (internalTasks.length > customerTasks.length) return 'internal';
  return 'unknown';
}

/**
 * Generate intervention suggestions based on stall issues
 */
function generateInterventions(issues: StallIssue[]): string[] {
  const interventions: string[] = [];
  const issueTypes = new Set(issues.map((i) => i.type));

  if (issueTypes.has('no_response')) {
    interventions.push('Call customer directly to understand blocker');
    interventions.push('Reach out to alternate stakeholder');
  }

  if (issueTypes.has('tasks_overdue')) {
    interventions.push('Review blocked tasks and offer assistance');
    interventions.push('Simplify or break down complex tasks');
  }

  if (issueTypes.has('user_not_activated')) {
    interventions.push('Send personalized activation reminder');
    interventions.push('Offer one-on-one setup assistance');
  }

  if (issueTypes.has('no_activity')) {
    interventions.push('Schedule sync call to re-engage');
    interventions.push('Share quick win opportunity');
  }

  if (issueTypes.has('phase_overdue')) {
    interventions.push('Offer technical assistance session');
    interventions.push('Escalate to customer executive sponsor');
  }

  // Always suggest these
  if (interventions.length === 0) {
    interventions.push('Send re-engagement email');
    interventions.push('Schedule status review call');
  }

  return [...new Set(interventions)].slice(0, 5);
}

// ============================================
// Core Detection Logic
// ============================================

/**
 * Detect if an onboarding is stalled
 * Implements the detection logic from PRD-098 Section 4.2
 */
export function detectOnboardingStall(
  check: OnboardingStallCheck
): StallResult | null {
  const now = new Date();
  const issues: StallIssue[] = [];

  // Get thresholds based on segment
  const rules = DEFAULT_STALL_RULES.filter(
    (r) => r.enabled && (!r.segment || r.segment === check.segment)
  );

  const getThreshold = (type: string): number => {
    const rule = rules.find((r) => r.conditionType === type);
    return rule?.thresholdDays ?? 5;
  };

  // Calculate days
  const daysSincePhaseStart = daysBetween(check.phaseStartDate, now);
  const daysSinceActivity = daysBetween(check.lastActivityDate, now);
  const daysSinceResponse = daysBetween(check.lastResponseDate, now);

  // FR-1.1: Phase taking too long
  const expectedPhaseDays =
    PHASE_DURATIONS[check.currentPhase]?.[check.segment] ??
    check.expectedDurationDays;
  const phaseOverdueThreshold = expectedPhaseDays * 1.5;

  if (daysSincePhaseStart > phaseOverdueThreshold) {
    const daysOverdue = daysSincePhaseStart - expectedPhaseDays;
    issues.push({
      type: 'phase_overdue',
      severity: calculateSeverity(daysOverdue),
      details: `Phase "${check.currentPhase}" is ${daysSincePhaseStart} days old (expected ${expectedPhaseDays} days)`,
      owner: determineStallOwner('phase_overdue', check.pendingTasks),
      daysStalled: daysOverdue,
    });
  }

  // FR-1.2: Tasks overdue by threshold days
  const overdueThreshold = getThreshold('tasks_overdue');
  const overdueTasks = check.pendingTasks.filter((t) => {
    if (!t.dueDate || t.status === 'completed') return false;
    const daysOverdue = businessDaysBetween(t.dueDate, now);
    return daysOverdue > overdueThreshold;
  });

  if (overdueTasks.length > 0) {
    const maxOverdue = Math.max(
      ...overdueTasks.map((t) => businessDaysBetween(t.dueDate!, now))
    );
    issues.push({
      type: 'tasks_overdue',
      severity: calculateSeverity(maxOverdue - overdueThreshold),
      details: `${overdueTasks.length} task(s) overdue by more than ${overdueThreshold} business days`,
      owner: determineStallOwner('tasks_overdue', overdueTasks),
      daysStalled: maxOverdue,
      tasks: overdueTasks,
    });
  }

  // FR-1.3: User activation stalls
  const activationThreshold = getThreshold('user_not_activated');
  const notActivatedUsers = check.invitedUsers.filter((u) => {
    if (u.activatedAt) return false;
    if (!u.invitedAt) return false;
    const daysSinceInvite = daysBetween(u.invitedAt, now);
    return daysSinceInvite > activationThreshold;
  });

  if (notActivatedUsers.length > 0) {
    const maxDays = Math.max(
      ...notActivatedUsers.map((u) => daysBetween(u.invitedAt!, now))
    );
    issues.push({
      type: 'user_not_activated',
      severity: calculateSeverity(maxDays - activationThreshold),
      details: `${notActivatedUsers.length} user(s) invited but not activated after ${activationThreshold}+ days`,
      owner: 'customer',
      daysStalled: maxDays,
      users: notActivatedUsers,
    });
  }

  // FR-1.4: No activity stall (covers configuration/integration stalls)
  const activityThreshold = getThreshold('no_activity');
  if (daysSinceActivity > activityThreshold) {
    issues.push({
      type: 'no_activity',
      severity: calculateSeverity(daysSinceActivity - activityThreshold),
      details: `No onboarding activity in ${daysSinceActivity} days`,
      owner: determineStallOwner('no_activity', check.pendingTasks),
      daysStalled: daysSinceActivity,
    });
  }

  // FR-1.5: Communication stalls (no response)
  const responseThreshold = getThreshold('no_response');
  if (daysSinceResponse > responseThreshold) {
    issues.push({
      type: 'no_response',
      severity: calculateSeverity(daysSinceResponse - responseThreshold),
      details: `Customer hasn't responded in ${daysSinceResponse} days`,
      owner: 'customer',
      daysStalled: daysSinceResponse,
    });
  }

  // No stall detected
  if (issues.length === 0) {
    return null;
  }

  // Calculate overall metrics
  const highestSeverity = issues.reduce((max, issue) => {
    const severityOrder: StallIssueSeverity[] = ['low', 'medium', 'high', 'critical'];
    return severityOrder.indexOf(issue.severity) > severityOrder.indexOf(max)
      ? issue.severity
      : max;
  }, 'low' as StallIssueSeverity);

  const daysInOnboarding = daysBetween(
    new Date(check.phaseStartDate.getTime() - expectedPhaseDays * 24 * 60 * 60 * 1000),
    now
  );

  // Determine primary blocker
  const sortedIssues = [...issues].sort((a, b) => {
    const severityOrder: StallIssueSeverity[] = ['low', 'medium', 'high', 'critical'];
    return severityOrder.indexOf(b.severity) - severityOrder.indexOf(a.severity);
  });
  const primaryBlocker = sortedIssues[0].details;

  // Check if escalation is needed (stall > 10 days per FR-3.4)
  const maxDaysStalled = Math.max(...issues.map((i) => i.daysStalled));
  const requiresEscalation = maxDaysStalled > 10;

  return {
    isStalled: true,
    customerId: check.customerId,
    customerName: check.customerName,
    phase: check.currentPhase,
    issues,
    highestSeverity,
    primaryBlocker,
    daysInOnboarding,
    targetOnboardingDays: EXPECTED_ONBOARDING_DAYS[check.segment],
    suggestedInterventions: generateInterventions(issues),
    requiresEscalation,
    arr: check.arr,
    segment: check.segment,
    csmId: check.csmId,
    csmName: check.csmName,
  };
}

// ============================================
// Database Operations
// ============================================

/**
 * Fetch all customers currently in onboarding stage
 */
export async function getOnboardingCustomers(): Promise<OnboardingStallCheck[]> {
  if (!supabase) {
    // Return mock data for development
    return getMockOnboardingCustomers();
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: customers, error } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        arr,
        stage,
        health_score,
        assigned_csm_id,
        created_at,
        updated_at
      `)
      .eq('stage', 'onboarding')
      .lt('created_at', sevenDaysAgo.toISOString());

    if (error) throw error;
    if (!customers || customers.length === 0) return [];

    const stallChecks: OnboardingStallCheck[] = [];

    for (const customer of customers) {
      // Fetch related data for each customer
      const [tasksResult, usersResult, activityResult] = await Promise.all([
        supabase
          .from('onboarding_tasks')
          .select('*')
          .eq('customer_id', customer.id)
          .neq('status', 'completed'),
        supabase
          .from('customer_users')
          .select('*')
          .eq('customer_id', customer.id),
        supabase
          .from('activity_feed')
          .select('created_at')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      const tasks: OnboardingTask[] = (tasksResult.data || []).map((t: any) => ({
        id: t.id,
        task: t.title || t.task,
        owner: t.owner || 'unknown',
        status: t.status || 'pending',
        dueDate: t.due_date ? new Date(t.due_date) : undefined,
        blockedReason: t.blocked_reason,
      }));

      const users: OnboardingUser[] = (usersResult.data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        invitedAt: u.invited_at ? new Date(u.invited_at) : undefined,
        activatedAt: u.activated_at ? new Date(u.activated_at) : undefined,
        lastActiveAt: u.last_active_at ? new Date(u.last_active_at) : undefined,
      }));

      const lastActivity = activityResult.data?.[0]?.created_at
        ? new Date(activityResult.data[0].created_at)
        : new Date(customer.updated_at);

      const segment = getSegmentFromARR(customer.arr || 0);

      stallChecks.push({
        customerId: customer.id,
        customerName: customer.name,
        currentPhase: 'onboarding', // Would need phase tracking
        phaseStartDate: new Date(customer.created_at),
        lastActivityDate: lastActivity,
        lastResponseDate: lastActivity, // Would need email tracking
        pendingTasks: tasks,
        invitedUsers: users,
        expectedDurationDays: EXPECTED_ONBOARDING_DAYS[segment],
        segment,
        arr: customer.arr || 0,
        csmId: customer.assigned_csm_id,
      });
    }

    return stallChecks;
  } catch (error) {
    console.error('Error fetching onboarding customers:', error);
    return [];
  }
}

/**
 * Mock data for development without database
 */
function getMockOnboardingCustomers(): OnboardingStallCheck[] {
  const now = new Date();

  return [
    {
      customerId: 'mock-stalled-1',
      customerName: 'Acme Corporation',
      currentPhase: 'technical_setup',
      phaseStartDate: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      lastActivityDate: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
      lastResponseDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      pendingTasks: [
        {
          id: 'task-1',
          task: 'API Configuration',
          owner: 'Customer - Tech Team',
          status: 'blocked',
          dueDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days overdue
          blockedReason: 'Waiting on customer credentials',
        },
        {
          id: 'task-2',
          task: 'Data Migration',
          owner: 'Internal - Engineering',
          status: 'pending',
          dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
        },
      ],
      invitedUsers: [
        {
          id: 'user-1',
          name: 'John Smith',
          email: 'john@acme.com',
          invitedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
          activatedAt: undefined, // Not activated
        },
      ],
      expectedDurationDays: 30,
      segment: 'mid-market',
      arr: 45000,
      csmId: 'csm-123',
      csmName: 'Sarah Johnson',
      csmManagerId: 'manager-456',
    },
    {
      customerId: 'mock-stalled-2',
      customerName: 'TechStart Inc',
      currentPhase: 'training',
      phaseStartDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      lastActivityDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      lastResponseDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      pendingTasks: [
        {
          id: 'task-3',
          task: 'Complete training modules',
          owner: 'Customer - End Users',
          status: 'in_progress',
          dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days overdue
        },
      ],
      invitedUsers: [
        {
          id: 'user-2',
          name: 'Emily Chen',
          email: 'emily@techstart.com',
          invitedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
          activatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          lastActiveAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        },
      ],
      expectedDurationDays: 14,
      segment: 'smb',
      arr: 12000,
      csmId: 'csm-789',
      csmName: 'Mike Wilson',
    },
  ];
}

// ============================================
// Dashboard Data
// ============================================

/**
 * Get stalled onboardings dashboard data
 */
export async function getStalledOnboardingsDashboard(): Promise<OnboardingStallDashboard> {
  const customers = await getOnboardingCustomers();
  const stallResults: StallResult[] = [];

  for (const customer of customers) {
    const result = detectOnboardingStall(customer);
    if (result) {
      stallResults.push(result);
    }
  }

  // Build dashboard metrics
  const totalArrAtRisk = stallResults.reduce((sum, r) => sum + r.arr, 0);
  const averageDaysStalled =
    stallResults.length > 0
      ? stallResults.reduce(
          (sum, r) => sum + Math.max(...r.issues.map((i) => i.daysStalled)),
          0
        ) / stallResults.length
      : 0;

  const stalledByPhase: Record<string, number> = {};
  const stalledBySeverity: Record<StallIssueSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  const stalledCards: StalledOnboardingCard[] = stallResults.map((result) => {
    // Track by phase
    stalledByPhase[result.phase] = (stalledByPhase[result.phase] || 0) + 1;

    // Track by severity
    stalledBySeverity[result.highestSeverity]++;

    // Calculate phase progress (simplified)
    const phaseProgress = Math.min(
      100,
      Math.round((result.daysInOnboarding / result.targetOnboardingDays) * 100)
    );

    return {
      customerId: result.customerId,
      customerName: result.customerName,
      arr: result.arr,
      segment: result.segment,
      daysInOnboarding: result.daysInOnboarding,
      targetDays: result.targetOnboardingDays,
      currentPhase: result.phase,
      phaseProgress,
      primaryBlocker: result.primaryBlocker,
      daysSinceActivity: Math.max(...result.issues.map((i) => i.daysStalled)),
      issueCount: result.issues.length,
      highestSeverity: result.highestSeverity,
      stallDetectedAt: new Date(),
      suggestedAction: result.suggestedInterventions[0] || 'Review onboarding status',
    };
  });

  // Sort by severity then ARR
  stalledCards.sort((a, b) => {
    const severityOrder: StallIssueSeverity[] = ['critical', 'high', 'medium', 'low'];
    const severityDiff =
      severityOrder.indexOf(a.highestSeverity) -
      severityOrder.indexOf(b.highestSeverity);
    if (severityDiff !== 0) return severityDiff;
    return b.arr - a.arr;
  });

  return {
    totalStalledOnboardings: stallResults.length,
    totalArrAtRisk,
    averageDaysStalled: Math.round(averageDaysStalled),
    stalledByPhase,
    stalledBySeverity,
    stalledOnboardings: stalledCards,
  };
}

/**
 * Run stall detection for all onboarding customers
 */
export async function runStallDetection(): Promise<StallResult[]> {
  const customers = await getOnboardingCustomers();
  const results: StallResult[] = [];

  for (const customer of customers) {
    const result = detectOnboardingStall(customer);
    if (result) {
      results.push(result);
      console.log(
        `[Stall Detected] ${customer.customerName}: ${result.issues.length} issues, severity: ${result.highestSeverity}`
      );
    }
  }

  return results;
}

export default {
  detectOnboardingStall,
  getOnboardingCustomers,
  getStalledOnboardingsDashboard,
  runStallDetection,
};
