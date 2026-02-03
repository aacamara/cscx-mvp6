/**
 * Account Team View Types
 * PRD-072: Unified view of internal team members associated with a customer account
 */

// ============================================
// Account Team Role Types
// ============================================

export type AccountTeamRole =
  | 'csm'           // Customer Success Manager
  | 'ae'            // Account Executive
  | 'se'            // Solutions Engineer
  | 'tam'           // Technical Account Manager
  | 'support_lead'  // Support Manager
  | 'exec_sponsor'  // Executive Sponsor
  | 'partner_mgr'   // Partner Manager
  | 'implementation'// Implementation Lead
  | 'training';     // Training Specialist

export const ROLE_LABELS: Record<AccountTeamRole, string> = {
  csm: 'Customer Success Manager',
  ae: 'Account Executive',
  se: 'Solutions Engineer',
  tam: 'Technical Account Manager',
  support_lead: 'Support Lead',
  exec_sponsor: 'Executive Sponsor',
  partner_mgr: 'Partner Manager',
  implementation: 'Implementation Lead',
  training: 'Training Specialist',
};

export const ROLE_DESCRIPTIONS: Record<AccountTeamRole, string> = {
  csm: 'Relationship, adoption, renewal',
  ae: 'Commercial, expansion',
  se: 'Technical, implementation',
  tam: 'Technical guidance',
  support_lead: 'Escalations, technical issues',
  exec_sponsor: 'Strategic alignment',
  partner_mgr: 'Partner-related coordination',
  implementation: 'Onboarding, deployment',
  training: 'Education, enablement',
};

export type MemberStatus = 'active' | 'inactive' | 'transitioning';

// ============================================
// Account Team Member Types
// ============================================

export interface AccountTeamMember {
  id: string;
  userId: string;
  customerId: string;
  role: AccountTeamRole;
  isPrimary: boolean;

  // User info (joined from users table)
  name: string;
  email: string;
  title: string;
  phone: string | null;
  slackHandle: string | null;
  photoUrl: string | null;

  // Assignment info
  assignedDate: string;
  assignedBy: string | null;
  endDate: string | null;
  status: MemberStatus;

  // Activity tracking
  lastActivity: string | null;
  activityCount30d: number;
  nextScheduledAction: string | null;
}

export interface AccountTeamActivity {
  id: string;
  userId: string;
  userName: string;
  customerId: string;
  activityType: string;
  description: string;
  timestamp: string;
  visibility: 'team' | 'private';
}

// ============================================
// Team Coverage Types
// ============================================

export interface RoleCoverage {
  role: AccountTeamRole;
  roleLabel: string;
  required: boolean;
  assigned: AccountTeamMember | null;
  status: 'covered' | 'gap' | 'as_needed';
}

export interface EngagementBalance {
  userId: string;
  name: string;
  role: AccountTeamRole;
  touchPoints30d: number;
  expectedMin: number;
  expectedMax: number;
  status: 'active' | 'ok' | 'overdue';
}

export interface CoverageAnalysis {
  roleCoverage: RoleCoverage[];
  engagementBalance: EngagementBalance[];
  coverageScore: number;
  gaps: string[];
  recommendations: string[];
}

// ============================================
// Team Coordination Types
// ============================================

export interface CoordinationEvent {
  id: string;
  date: string;
  topic: string;
  participants: string[];
  outcome: string | null;
  status: 'completed' | 'scheduled' | 'proposed';
}

export interface CommunicationChannel {
  type: 'slack' | 'drive' | 'crm';
  name: string;
  url: string | null;
  memberCount?: number;
  isActive?: boolean;
}

// ============================================
// Team History Types
// ============================================

export interface TeamChange {
  id: string;
  date: string;
  changeType: 'assigned' | 'removed' | 'role_change' | 'transition';
  description: string;
  userId: string | null;
  userName: string | null;
  previousValue: string | null;
  newValue: string | null;
}

// ============================================
// API Response Types
// ============================================

export interface AccountTeamResponse {
  customerId: string;
  customerName: string;
  lastUpdated: string;

  // Team coverage
  coverageScore: number;
  coverageStatus: 'excellent' | 'good' | 'needs_attention' | 'critical';

  // Core and extended team
  coreTeam: AccountTeamMember[];
  extendedTeam: AccountTeamMember[];
  historicalTeam?: AccountTeamMember[];

  // Activity
  recentActivity: AccountTeamActivity[];

  // Communication channels
  channels: CommunicationChannel[];

  // Coordination
  recentCoordination: CoordinationEvent[];
  upcomingCoordination: CoordinationEvent[];

  // Coverage analysis
  coverage: CoverageAnalysis;

  // History
  teamChanges: TeamChange[];
}

export interface AccountTeamSummary {
  customerId: string;
  customerName: string;
  csmName: string | null;
  teamSize: number;
  coverageScore: number;
  lastTeamActivity: string | null;
  openGaps: number;
}

// ============================================
// API Request Types
// ============================================

export interface AddTeamMemberRequest {
  userId: string;
  role: AccountTeamRole;
  isPrimary?: boolean;
}

export interface UpdateTeamMemberRequest {
  role?: AccountTeamRole;
  isPrimary?: boolean;
  status?: MemberStatus;
  endDate?: string | null;
}

// ============================================
// Filter Types
// ============================================

export interface AccountTeamFilters {
  includeHistorical?: boolean;
  roleFilter?: AccountTeamRole | 'all';
  statusFilter?: MemberStatus | 'all';
}
