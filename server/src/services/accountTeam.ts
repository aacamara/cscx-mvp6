/**
 * Account Team Service
 * PRD-072: Backend service for account team management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Types
type AccountTeamRole =
  | 'csm'
  | 'ae'
  | 'se'
  | 'tam'
  | 'support_lead'
  | 'exec_sponsor'
  | 'partner_mgr'
  | 'implementation'
  | 'training';

type MemberStatus = 'active' | 'inactive' | 'transitioning';

interface AccountTeamMember {
  id: string;
  userId: string;
  customerId: string;
  role: AccountTeamRole;
  isPrimary: boolean;
  name: string;
  email: string;
  title: string;
  phone: string | null;
  slackHandle: string | null;
  photoUrl: string | null;
  assignedDate: string;
  assignedBy: string | null;
  endDate: string | null;
  status: MemberStatus;
  lastActivity: string | null;
  activityCount30d: number;
  nextScheduledAction: string | null;
}

interface AccountTeamActivity {
  id: string;
  userId: string;
  userName: string;
  customerId: string;
  activityType: string;
  description: string;
  timestamp: string;
  visibility: 'team' | 'private';
}

interface CoordinationEvent {
  id: string;
  date: string;
  topic: string;
  participants: string[];
  outcome: string | null;
  status: 'completed' | 'scheduled' | 'proposed';
}

interface CommunicationChannel {
  type: 'slack' | 'drive' | 'crm';
  name: string;
  url: string | null;
  memberCount?: number;
  isActive?: boolean;
}

interface RoleCoverage {
  role: AccountTeamRole;
  roleLabel: string;
  required: boolean;
  assigned: AccountTeamMember | null;
  status: 'covered' | 'gap' | 'as_needed';
}

interface TeamChange {
  id: string;
  date: string;
  changeType: 'assigned' | 'removed' | 'role_change' | 'transition';
  description: string;
  userId: string | null;
  userName: string | null;
}

interface AccountTeamResponse {
  customerId: string;
  customerName: string;
  lastUpdated: string;
  coverageScore: number;
  coverageStatus: 'excellent' | 'good' | 'needs_attention' | 'critical';
  coreTeam: AccountTeamMember[];
  extendedTeam: AccountTeamMember[];
  historicalTeam?: AccountTeamMember[];
  recentActivity: AccountTeamActivity[];
  channels: CommunicationChannel[];
  recentCoordination: CoordinationEvent[];
  upcomingCoordination: CoordinationEvent[];
  coverage: {
    roleCoverage: RoleCoverage[];
    engagementBalance: any[];
    coverageScore: number;
    gaps: string[];
    recommendations: string[];
  };
  teamChanges: TeamChange[];
}

const ROLE_LABELS: Record<AccountTeamRole, string> = {
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

// Core roles that should always be assigned (when applicable)
const CORE_ROLES: AccountTeamRole[] = ['csm', 'ae', 'se'];
const EXTENDED_ROLES: AccountTeamRole[] = ['tam', 'support_lead', 'exec_sponsor', 'partner_mgr', 'implementation', 'training'];

// Expected engagement frequencies (touches per 30 days)
const ENGAGEMENT_EXPECTATIONS: Record<AccountTeamRole, { min: number; max: number }> = {
  csm: { min: 4, max: 8 },
  ae: { min: 2, max: 4 },
  se: { min: 0, max: 2 }, // As needed
  tam: { min: 2, max: 4 },
  support_lead: { min: 0, max: 4 }, // As needed
  exec_sponsor: { min: 0, max: 1 }, // Quarterly
  partner_mgr: { min: 0, max: 2 },
  implementation: { min: 0, max: 0 }, // During implementation only
  training: { min: 0, max: 2 },
};

class AccountTeamService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Get account team for a customer
   */
  async getAccountTeam(
    customerId: string,
    includeHistorical: boolean = false
  ): Promise<AccountTeamResponse | null> {
    // Get customer info
    const customer = await this.getCustomer(customerId);
    if (!customer) {
      return null;
    }

    // Get team members
    const allMembers = await this.getTeamMembers(customerId, includeHistorical);

    // Separate core and extended team
    const coreTeam = allMembers.filter(
      m => CORE_ROLES.includes(m.role) && m.status === 'active'
    );
    const extendedTeam = allMembers.filter(
      m => EXTENDED_ROLES.includes(m.role) && m.status === 'active'
    );
    const historicalTeam = includeHistorical
      ? allMembers.filter(m => m.status === 'inactive')
      : undefined;

    // Get activities
    const recentActivity = await this.getRecentActivity(customerId);

    // Get communication channels
    const channels = await this.getCommunicationChannels(customerId, customer.name);

    // Get coordination events
    const { recent: recentCoordination, upcoming: upcomingCoordination } =
      await this.getCoordinationEvents(customerId);

    // Calculate coverage analysis
    const coverage = this.calculateCoverageAnalysis(allMembers.filter(m => m.status === 'active'));

    // Get team change history
    const teamChanges = await this.getTeamChanges(customerId);

    // Calculate coverage score and status
    const coverageScore = coverage.coverageScore;
    const coverageStatus = this.getCoverageStatus(coverageScore);

    return {
      customerId,
      customerName: customer.name,
      lastUpdated: new Date().toISOString(),
      coverageScore,
      coverageStatus,
      coreTeam,
      extendedTeam,
      historicalTeam,
      recentActivity,
      channels,
      recentCoordination,
      upcomingCoordination,
      coverage,
      teamChanges,
    };
  }

  /**
   * Get customer info
   */
  private async getCustomer(customerId: string): Promise<{ id: string; name: string } | null> {
    if (!this.supabase) {
      // Return mock data for development
      return {
        id: customerId,
        name: 'Acme Corp',
      };
    }

    const { data, error } = await this.supabase
      .from('customers')
      .select('id, name')
      .eq('id', customerId)
      .single();

    if (error || !data) {
      console.error('Error fetching customer:', error);
      return null;
    }

    return data;
  }

  /**
   * Get team members for a customer
   */
  private async getTeamMembers(
    customerId: string,
    includeHistorical: boolean
  ): Promise<AccountTeamMember[]> {
    if (!this.supabase) {
      // Return mock data for development
      return this.getMockTeamMembers(customerId);
    }

    let query = this.supabase
      .from('account_team_members')
      .select(`
        id,
        user_id,
        customer_id,
        role,
        is_primary,
        assigned_date,
        assigned_by,
        end_date,
        status,
        users (
          id,
          name,
          email,
          title,
          phone,
          slack_handle,
          photo_url
        )
      `)
      .eq('customer_id', customerId);

    if (!includeHistorical) {
      query = query.eq('status', 'active');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching team members:', error);
      return this.getMockTeamMembers(customerId);
    }

    if (!data || data.length === 0) {
      return this.getMockTeamMembers(customerId);
    }

    // Fetch activity counts for each member
    const memberIds = data.map((m: any) => m.user_id);
    const activityCounts = await this.getActivityCounts(customerId, memberIds);

    return data.map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      customerId: m.customer_id,
      role: m.role as AccountTeamRole,
      isPrimary: m.is_primary,
      name: m.users?.name || 'Unknown',
      email: m.users?.email || '',
      title: m.users?.title || '',
      phone: m.users?.phone || null,
      slackHandle: m.users?.slack_handle || null,
      photoUrl: m.users?.photo_url || null,
      assignedDate: m.assigned_date,
      assignedBy: m.assigned_by,
      endDate: m.end_date,
      status: m.status as MemberStatus,
      lastActivity: activityCounts[m.user_id]?.lastActivity || null,
      activityCount30d: activityCounts[m.user_id]?.count || 0,
      nextScheduledAction: null, // TODO: Fetch from scheduled actions
    }));
  }

  /**
   * Get activity counts for team members
   */
  private async getActivityCounts(
    customerId: string,
    userIds: string[]
  ): Promise<Record<string, { count: number; lastActivity: string | null }>> {
    if (!this.supabase || userIds.length === 0) {
      return {};
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await this.supabase
      .from('agent_activity_log')
      .select('user_id, created_at')
      .eq('customer_id', customerId)
      .in('user_id', userIds)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching activity counts:', error);
      return {};
    }

    const counts: Record<string, { count: number; lastActivity: string | null }> = {};

    for (const userId of userIds) {
      const userActivities = data?.filter((a: any) => a.user_id === userId) || [];
      counts[userId] = {
        count: userActivities.length,
        lastActivity: userActivities[0]?.created_at || null,
      };
    }

    return counts;
  }

  /**
   * Get recent team activity
   */
  private async getRecentActivity(customerId: string): Promise<AccountTeamActivity[]> {
    if (!this.supabase) {
      return this.getMockActivities(customerId);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await this.supabase
      .from('agent_activity_log')
      .select(`
        id,
        user_id,
        customer_id,
        activity_type,
        description,
        created_at,
        visibility,
        users (name)
      `)
      .eq('customer_id', customerId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching activities:', error);
      return this.getMockActivities(customerId);
    }

    if (!data || data.length === 0) {
      return this.getMockActivities(customerId);
    }

    return data.map((a: any) => ({
      id: a.id,
      userId: a.user_id,
      userName: a.users?.name || 'Unknown',
      customerId: a.customer_id,
      activityType: a.activity_type,
      description: a.description,
      timestamp: a.created_at,
      visibility: a.visibility || 'team',
    }));
  }

  /**
   * Get communication channels for the account
   */
  private async getCommunicationChannels(
    customerId: string,
    customerName: string
  ): Promise<CommunicationChannel[]> {
    const channels: CommunicationChannel[] = [];

    // Generate expected channel names based on customer
    const slackChannelName = `#${customerName.toLowerCase().replace(/\s+/g, '-')}-account`;

    channels.push({
      type: 'slack',
      name: slackChannelName,
      url: null, // Would be populated from Slack integration
      memberCount: 6,
      isActive: true,
    });

    channels.push({
      type: 'drive',
      name: 'Account Folder',
      url: null, // Would be populated from Google Drive integration
    });

    channels.push({
      type: 'crm',
      name: 'CRM Record',
      url: null, // Would be populated from Salesforce/HubSpot integration
    });

    return channels;
  }

  /**
   * Get coordination events
   */
  private async getCoordinationEvents(
    customerId: string
  ): Promise<{ recent: CoordinationEvent[]; upcoming: CoordinationEvent[] }> {
    if (!this.supabase) {
      return {
        recent: this.getMockRecentCoordination(),
        upcoming: this.getMockUpcomingCoordination(),
      };
    }

    const now = new Date().toISOString();

    // Get recent completed coordination
    const { data: recentData } = await this.supabase
      .from('team_coordination_events')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'completed')
      .order('date', { ascending: false })
      .limit(5);

    // Get upcoming coordination
    const { data: upcomingData } = await this.supabase
      .from('team_coordination_events')
      .select('*')
      .eq('customer_id', customerId)
      .in('status', ['scheduled', 'proposed'])
      .gte('date', now)
      .order('date', { ascending: true })
      .limit(5);

    const mapEvent = (e: any): CoordinationEvent => ({
      id: e.id,
      date: e.date,
      topic: e.topic,
      participants: e.participants || [],
      outcome: e.outcome,
      status: e.status,
    });

    return {
      recent: recentData?.map(mapEvent) || this.getMockRecentCoordination(),
      upcoming: upcomingData?.map(mapEvent) || this.getMockUpcomingCoordination(),
    };
  }

  /**
   * Get team change history
   */
  private async getTeamChanges(customerId: string): Promise<TeamChange[]> {
    if (!this.supabase) {
      return this.getMockTeamChanges();
    }

    const { data, error } = await this.supabase
      .from('team_change_history')
      .select(`
        id,
        created_at,
        change_type,
        description,
        user_id,
        users (name)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      return this.getMockTeamChanges();
    }

    return data.map((c: any) => ({
      id: c.id,
      date: c.created_at,
      changeType: c.change_type,
      description: c.description,
      userId: c.user_id,
      userName: c.users?.name || null,
    }));
  }

  /**
   * Calculate coverage analysis
   */
  private calculateCoverageAnalysis(activeMembers: AccountTeamMember[]): {
    roleCoverage: RoleCoverage[];
    engagementBalance: any[];
    coverageScore: number;
    gaps: string[];
    recommendations: string[];
  } {
    const allRoles: AccountTeamRole[] = [...CORE_ROLES, ...EXTENDED_ROLES];
    const gaps: string[] = [];
    const recommendations: string[] = [];

    // Calculate role coverage
    const roleCoverage: RoleCoverage[] = allRoles.map(role => {
      const assigned = activeMembers.find(m => m.role === role) || null;
      const isRequired = role === 'csm'; // CSM is always required
      const isAsNeeded = EXTENDED_ROLES.includes(role);

      let status: 'covered' | 'gap' | 'as_needed';
      if (assigned) {
        status = 'covered';
      } else if (isRequired) {
        status = 'gap';
        gaps.push(`No ${ROLE_LABELS[role]} assigned`);
      } else {
        status = 'as_needed';
      }

      return {
        role,
        roleLabel: ROLE_LABELS[role],
        required: isRequired,
        assigned,
        status,
      };
    });

    // Calculate engagement balance
    const engagementBalance = activeMembers.map(member => {
      const expected = ENGAGEMENT_EXPECTATIONS[member.role];
      let status: 'active' | 'ok' | 'overdue';

      if (member.activityCount30d >= expected.min) {
        status = 'active';
      } else if (expected.min === 0) {
        status = 'ok';
      } else {
        status = 'overdue';
        recommendations.push(`Schedule touchpoint with ${ROLE_LABELS[member.role]} (${member.name})`);
      }

      return {
        userId: member.userId,
        name: member.name,
        role: member.role,
        touchPoints30d: member.activityCount30d,
        expectedMin: expected.min,
        expectedMax: expected.max,
        status,
      };
    });

    // Calculate coverage score
    const coreRolesCovered = CORE_ROLES.filter(role =>
      activeMembers.some(m => m.role === role)
    ).length;
    const coreRolesTotal = CORE_ROLES.length;

    // Score calculation: 60% for core roles, 40% for engagement health
    const coreScore = (coreRolesCovered / coreRolesTotal) * 60;
    const engagementHealthy = engagementBalance.filter(e => e.status !== 'overdue').length;
    const engagementScore = activeMembers.length > 0
      ? (engagementHealthy / activeMembers.length) * 40
      : 40;

    const coverageScore = Math.round(coreScore + engagementScore);

    // Add recommendations based on gaps
    if (!activeMembers.some(m => m.role === 'csm')) {
      recommendations.unshift('Assign a CSM to this account immediately');
    }
    if (!activeMembers.some(m => m.role === 'exec_sponsor')) {
      recommendations.push('Consider assigning an Executive Sponsor for strategic alignment');
    }

    return {
      roleCoverage,
      engagementBalance,
      coverageScore,
      gaps,
      recommendations,
    };
  }

  /**
   * Get coverage status based on score
   */
  private getCoverageStatus(score: number): 'excellent' | 'good' | 'needs_attention' | 'critical' {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'needs_attention';
    return 'critical';
  }

  /**
   * Add a team member
   */
  async addTeamMember(
    customerId: string,
    userId: string,
    role: AccountTeamRole,
    isPrimary: boolean = false,
    assignedBy?: string
  ): Promise<AccountTeamMember | null> {
    if (!this.supabase) {
      console.warn('Supabase not configured, returning mock data');
      return null;
    }

    // Check if member already exists
    const { data: existing } = await this.supabase
      .from('account_team_members')
      .select('id')
      .eq('customer_id', customerId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (existing) {
      throw new Error('Team member already assigned to this account');
    }

    // If setting as primary, unset other primary members for this role
    if (isPrimary) {
      await this.supabase
        .from('account_team_members')
        .update({ is_primary: false })
        .eq('customer_id', customerId)
        .eq('role', role)
        .eq('is_primary', true);
    }

    // Insert new team member
    const { data, error } = await this.supabase
      .from('account_team_members')
      .insert({
        customer_id: customerId,
        user_id: userId,
        role,
        is_primary: isPrimary,
        assigned_date: new Date().toISOString(),
        assigned_by: assignedBy,
        status: 'active',
      })
      .select(`
        id,
        user_id,
        customer_id,
        role,
        is_primary,
        assigned_date,
        assigned_by,
        status,
        users (
          id,
          name,
          email,
          title,
          phone,
          slack_handle,
          photo_url
        )
      `)
      .single();

    if (error) {
      console.error('Error adding team member:', error);
      throw new Error('Failed to add team member');
    }

    // Log the change
    await this.logTeamChange(customerId, 'assigned', `${data.users?.name || 'User'} assigned as ${ROLE_LABELS[role]}`, userId);

    return {
      id: data.id,
      userId: data.user_id,
      customerId: data.customer_id,
      role: data.role as AccountTeamRole,
      isPrimary: data.is_primary,
      name: data.users?.name || 'Unknown',
      email: data.users?.email || '',
      title: data.users?.title || '',
      phone: data.users?.phone || null,
      slackHandle: data.users?.slack_handle || null,
      photoUrl: data.users?.photo_url || null,
      assignedDate: data.assigned_date,
      assignedBy: data.assigned_by,
      endDate: null,
      status: data.status as MemberStatus,
      lastActivity: null,
      activityCount30d: 0,
      nextScheduledAction: null,
    };
  }

  /**
   * Update a team member
   */
  async updateTeamMember(
    customerId: string,
    memberId: string,
    updates: {
      role?: AccountTeamRole;
      isPrimary?: boolean;
      status?: MemberStatus;
      endDate?: string | null;
    }
  ): Promise<boolean> {
    if (!this.supabase) {
      console.warn('Supabase not configured');
      return false;
    }

    const updateData: any = {};

    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.isPrimary !== undefined) updateData.is_primary = updates.isPrimary;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;

    const { error } = await this.supabase
      .from('account_team_members')
      .update(updateData)
      .eq('id', memberId)
      .eq('customer_id', customerId);

    if (error) {
      console.error('Error updating team member:', error);
      return false;
    }

    // Log the change
    const changeDescription = Object.entries(updates)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    await this.logTeamChange(customerId, 'role_change', `Team member updated: ${changeDescription}`, null);

    return true;
  }

  /**
   * Remove a team member
   */
  async removeTeamMember(customerId: string, memberId: string): Promise<boolean> {
    if (!this.supabase) {
      console.warn('Supabase not configured');
      return false;
    }

    // Get member info before removing
    const { data: member } = await this.supabase
      .from('account_team_members')
      .select('user_id, role, users (name)')
      .eq('id', memberId)
      .single();

    // Soft delete by setting status to inactive and end_date
    const { error } = await this.supabase
      .from('account_team_members')
      .update({
        status: 'inactive',
        end_date: new Date().toISOString(),
      })
      .eq('id', memberId)
      .eq('customer_id', customerId);

    if (error) {
      console.error('Error removing team member:', error);
      return false;
    }

    // Log the change
    if (member) {
      await this.logTeamChange(
        customerId,
        'removed',
        `${(member as any).users?.name || 'User'} removed from ${ROLE_LABELS[(member as any).role as AccountTeamRole]}`,
        (member as any).user_id
      );
    }

    return true;
  }

  /**
   * Log a team change
   */
  private async logTeamChange(
    customerId: string,
    changeType: 'assigned' | 'removed' | 'role_change' | 'transition',
    description: string,
    userId: string | null
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('team_change_history').insert({
      customer_id: customerId,
      change_type: changeType,
      description,
      user_id: userId,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Log team activity
   */
  async logActivity(
    customerId: string,
    userId: string,
    activityType: string,
    description: string,
    visibility: 'team' | 'private' = 'team'
  ): Promise<boolean> {
    if (!this.supabase) {
      console.warn('Supabase not configured');
      return false;
    }

    const { error } = await this.supabase.from('agent_activity_log').insert({
      customer_id: customerId,
      user_id: userId,
      activity_type: activityType,
      description,
      visibility,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error logging activity:', error);
      return false;
    }

    return true;
  }

  /**
   * Schedule a team sync
   */
  async scheduleSync(
    customerId: string,
    topic: string,
    participants: string[],
    proposedDate: string
  ): Promise<CoordinationEvent | null> {
    if (!this.supabase) {
      console.warn('Supabase not configured');
      return null;
    }

    const { data, error } = await this.supabase
      .from('team_coordination_events')
      .insert({
        customer_id: customerId,
        topic,
        participants,
        date: proposedDate,
        status: 'proposed',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error scheduling sync:', error);
      return null;
    }

    return {
      id: data.id,
      date: data.date,
      topic: data.topic,
      participants: data.participants || [],
      outcome: null,
      status: 'proposed',
    };
  }

  /**
   * Search users for team member assignment
   */
  async searchUsers(query: string, limit: number = 10): Promise<Array<{
    id: string;
    name: string;
    email: string;
    title: string;
  }>> {
    if (!this.supabase) {
      // Return mock data
      return [
        { id: '1', name: 'Sarah Johnson', email: 'sarah@company.com', title: 'CSM' },
        { id: '2', name: 'Mike Chen', email: 'mike@company.com', title: 'Account Executive' },
        { id: '3', name: 'Amy Rodriguez', email: 'amy@company.com', title: 'Solutions Engineer' },
      ].filter(u => u.name.toLowerCase().includes(query.toLowerCase()));
    }

    const { data, error } = await this.supabase
      .from('users')
      .select('id, name, email, title')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(limit);

    if (error) {
      console.error('Error searching users:', error);
      return [];
    }

    return data || [];
  }

  // ============================================
  // MOCK DATA GENERATORS (for development)
  // ============================================

  private getMockTeamMembers(customerId: string): AccountTeamMember[] {
    return [
      {
        id: '1',
        userId: 'user-1',
        customerId,
        role: 'csm',
        isPrimary: true,
        name: 'Sarah Johnson',
        email: 'sarah.johnson@company.com',
        title: 'Customer Success Manager',
        phone: '(555) 123-4567',
        slackHandle: '@sarah.johnson',
        photoUrl: null,
        assignedDate: '2024-03-15T00:00:00Z',
        assignedBy: null,
        endDate: null,
        status: 'active',
        lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        activityCount30d: 8,
        nextScheduledAction: 'Monthly check-in (Feb 5)',
      },
      {
        id: '2',
        userId: 'user-2',
        customerId,
        role: 'ae',
        isPrimary: false,
        name: 'Mike Chen',
        email: 'mike.chen@company.com',
        title: 'Account Executive',
        phone: null,
        slackHandle: '@mike.chen',
        photoUrl: null,
        assignedDate: '2024-01-01T00:00:00Z',
        assignedBy: null,
        endDate: null,
        status: 'active',
        lastActivity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        activityCount30d: 3,
        nextScheduledAction: null,
      },
      {
        id: '3',
        userId: 'user-3',
        customerId,
        role: 'se',
        isPrimary: false,
        name: 'Amy Rodriguez',
        email: 'amy.rodriguez@company.com',
        title: 'Solutions Engineer',
        phone: null,
        slackHandle: '@amy.rodriguez',
        photoUrl: null,
        assignedDate: '2024-06-01T00:00:00Z',
        assignedBy: null,
        endDate: null,
        status: 'active',
        lastActivity: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        activityCount30d: 1,
        nextScheduledAction: null,
      },
      {
        id: '4',
        userId: 'user-4',
        customerId,
        role: 'support_lead',
        isPrimary: false,
        name: 'David Kim',
        email: 'david.kim@company.com',
        title: 'Support Manager',
        phone: null,
        slackHandle: '@david.kim',
        photoUrl: null,
        assignedDate: '2024-08-01T00:00:00Z',
        assignedBy: null,
        endDate: null,
        status: 'active',
        lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        activityCount30d: 2,
        nextScheduledAction: null,
      },
      {
        id: '5',
        userId: 'user-5',
        customerId,
        role: 'exec_sponsor',
        isPrimary: false,
        name: 'Jane Smith',
        email: 'jane.smith@company.com',
        title: 'VP of Customer Success',
        phone: null,
        slackHandle: '@jane.smith',
        photoUrl: null,
        assignedDate: '2024-01-01T00:00:00Z',
        assignedBy: null,
        endDate: null,
        status: 'active',
        lastActivity: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        activityCount30d: 0,
        nextScheduledAction: null,
      },
      {
        id: '6',
        userId: 'user-6',
        customerId,
        role: 'training',
        isPrimary: false,
        name: 'Mark Wilson',
        email: 'mark.wilson@company.com',
        title: 'Training Specialist',
        phone: null,
        slackHandle: '@mark.wilson',
        photoUrl: null,
        assignedDate: '2024-10-01T00:00:00Z',
        assignedBy: null,
        endDate: null,
        status: 'active',
        lastActivity: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        activityCount30d: 1,
        nextScheduledAction: null,
      },
    ];
  }

  private getMockActivities(customerId: string): AccountTeamActivity[] {
    const now = Date.now();
    return [
      {
        id: '1',
        userId: 'user-1',
        userName: 'Sarah J.',
        customerId,
        activityType: 'Email Sent',
        description: 'Monthly check-in email',
        timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        visibility: 'team',
      },
      {
        id: '2',
        userId: 'user-4',
        userName: 'David K.',
        customerId,
        activityType: 'Support',
        description: 'Escalation resolved - Ticket #4521',
        timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        visibility: 'team',
      },
      {
        id: '3',
        userId: 'user-2',
        userName: 'Mike C.',
        customerId,
        activityType: 'Meeting',
        description: 'Expansion discussion call',
        timestamp: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
        visibility: 'team',
      },
      {
        id: '4',
        userId: 'user-1',
        userName: 'Sarah J.',
        customerId,
        activityType: 'Meeting',
        description: 'QBR preparation session',
        timestamp: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(),
        visibility: 'team',
      },
      {
        id: '5',
        userId: 'user-3',
        userName: 'Amy R.',
        customerId,
        activityType: 'Call',
        description: 'API integration support call',
        timestamp: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
        visibility: 'team',
      },
      {
        id: '6',
        userId: 'user-6',
        userName: 'Mark W.',
        customerId,
        activityType: 'Training',
        description: 'Power user workshop completed',
        timestamp: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
        visibility: 'team',
      },
    ];
  }

  private getMockRecentCoordination(): CoordinationEvent[] {
    const now = Date.now();
    return [
      {
        id: '1',
        date: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
        topic: 'Expansion strategy',
        participants: ['Sarah', 'Mike'],
        outcome: 'Agreed on approach',
        status: 'completed',
      },
      {
        id: '2',
        date: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
        topic: 'Support escalation',
        participants: ['Sarah', 'David'],
        outcome: 'Issue resolved',
        status: 'completed',
      },
      {
        id: '3',
        date: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(),
        topic: 'QBR prep',
        participants: ['Sarah', 'Mike', 'Jane'],
        outcome: 'Plan finalized',
        status: 'completed',
      },
    ];
  }

  private getMockUpcomingCoordination(): CoordinationEvent[] {
    const now = Date.now();
    return [
      {
        id: '4',
        date: new Date(now + 6 * 24 * 60 * 60 * 1000).toISOString(),
        topic: 'Monthly sync',
        participants: ['Sarah', 'Mike'],
        outcome: null,
        status: 'scheduled',
      },
      {
        id: '5',
        date: new Date(now + 16 * 24 * 60 * 60 * 1000).toISOString(),
        topic: 'Pre-renewal planning',
        participants: ['Sarah', 'Mike', 'Jane'],
        outcome: null,
        status: 'proposed',
      },
    ];
  }

  private getMockTeamChanges(): TeamChange[] {
    return [
      {
        id: '1',
        date: '2024-03-15T00:00:00Z',
        changeType: 'assigned',
        description: 'Sarah J. assigned as CSM (took over from John D.)',
        userId: 'user-1',
        userName: 'Sarah Johnson',
      },
      {
        id: '2',
        date: '2024-01-01T00:00:00Z',
        changeType: 'assigned',
        description: 'Mike C. assigned as AE for expansion focus',
        userId: 'user-2',
        userName: 'Mike Chen',
      },
      {
        id: '3',
        date: '2024-05-15T00:00:00Z',
        changeType: 'transition',
        description: 'Implementation completed - team transitioned to BAU',
        userId: null,
        userName: null,
      },
    ];
  }
}

export const accountTeamService = new AccountTeamService();
export default accountTeamService;
