/**
 * Quick Actions Service - PRD-265
 *
 * Provides backend logic for mobile quick action widgets:
 * - Widget data fetching (customer health, tasks, portfolio overview)
 * - Quick action execution (notes, tasks, voice notes, calls)
 * - Widget configuration management
 * - Caching for offline support
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export type WidgetType =
  | 'customer_quick_view'
  | 'portfolio_overview'
  | 'tasks_today'
  | 'quick_compose'
  | 'notification_summary';

export type WidgetSize = 'small' | 'medium' | 'large';

export type QuickActionType =
  | 'quick_note'
  | 'check_health'
  | 'create_task'
  | 'voice_note'
  | 'call_contact';

export interface CustomerSummary {
  id: string;
  name: string;
  healthScore: number;
  healthTrend: 'up' | 'down' | 'stable';
  arr: number;
  renewalDate: string | null;
  isAtRisk: boolean;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  customerId?: string;
  customerName?: string;
  isOverdue: boolean;
}

export interface PortfolioOverview {
  totalCustomers: number;
  totalArr: number;
  avgHealthScore: number;
  atRiskCount: number;
  renewalsThisMonth: number;
  pendingTasksCount: number;
  pendingApprovalsCount: number;
}

export interface WidgetConfig {
  id: string;
  userId: string;
  widgetType: WidgetType;
  size: WidgetSize;
  position: number;
  settings: {
    customerIds?: string[];
    defaultAction?: QuickActionType;
    refreshInterval?: number; // minutes
    theme?: 'light' | 'dark' | 'system';
  };
  createdAt: string;
  updatedAt: string;
}

export interface QuickNoteInput {
  customerId: string;
  content: string;
  isVoiceNote?: boolean;
  audioUrl?: string;
}

export interface QuickTaskInput {
  customerId?: string;
  title: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface WidgetDataResponse {
  customers?: CustomerSummary[];
  tasks?: TaskSummary[];
  portfolio?: PortfolioOverview;
  notifications?: NotificationSummary[];
  lastUpdated: string;
  cacheExpiry: string;
}

export interface NotificationSummary {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: string;
  customerId?: string;
  createdAt: string;
}

// ============================================
// Quick Actions Service
// ============================================

class QuickActionsService {
  private widgetCache: Map<string, { data: WidgetDataResponse; expiry: Date }> = new Map();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Get priority customers for widget display
   */
  async getPriorityCustomers(
    userId: string,
    limit: number = 5,
    customerIds?: string[]
  ): Promise<CustomerSummary[]> {
    if (!supabase) {
      return this.getMockPriorityCustomers(limit);
    }

    let query = supabase
      .from('customers')
      .select('id, name, health_score, arr, renewal_date, status')
      .eq('assigned_csm_id', userId);

    if (customerIds && customerIds.length > 0) {
      query = query.in('id', customerIds);
    }

    const { data, error } = await query
      .order('health_score', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching priority customers:', error);
      return [];
    }

    // Get health score history for trend calculation
    const customerSummaries: CustomerSummary[] = [];

    for (const customer of data || []) {
      const trend = await this.calculateHealthTrend(customer.id);
      const contact = await this.getPrimaryContact(customer.id);

      customerSummaries.push({
        id: customer.id,
        name: customer.name,
        healthScore: customer.health_score || 0,
        healthTrend: trend,
        arr: customer.arr || 0,
        renewalDate: customer.renewal_date,
        isAtRisk: (customer.health_score || 0) < 40 || customer.status === 'at_risk',
        primaryContactEmail: contact?.email,
        primaryContactPhone: contact?.phone,
      });
    }

    return customerSummaries;
  }

  /**
   * Get tasks due today for the user
   */
  async getTasksToday(userId: string, limit: number = 10): Promise<TaskSummary[]> {
    if (!supabase) {
      return this.getMockTasksToday(limit);
    }

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        due_date,
        priority,
        customer_id,
        customers (name)
      `)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .lte('due_date', tomorrow)
      .order('due_date', { ascending: true })
      .order('priority', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }

    return (data || []).map(task => ({
      id: task.id,
      title: task.title,
      dueDate: task.due_date,
      priority: task.priority || 'medium',
      customerId: task.customer_id,
      customerName: (task.customers as any)?.name,
      isOverdue: new Date(task.due_date) < new Date(today),
    }));
  }

  /**
   * Get portfolio overview metrics
   */
  async getPortfolioOverview(userId: string): Promise<PortfolioOverview> {
    if (!supabase) {
      return this.getMockPortfolioOverview();
    }

    // Get customer metrics
    const { data: customers } = await supabase
      .from('customers')
      .select('id, health_score, arr, renewal_date, status')
      .eq('assigned_csm_id', userId);

    const customerList = customers || [];
    const totalCustomers = customerList.length;
    const totalArr = customerList.reduce((sum, c) => sum + (c.arr || 0), 0);
    const avgHealthScore = totalCustomers > 0
      ? Math.round(customerList.reduce((sum, c) => sum + (c.health_score || 0), 0) / totalCustomers)
      : 0;
    const atRiskCount = customerList.filter(c => (c.health_score || 0) < 40 || c.status === 'at_risk').length;

    // Get renewals this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const renewalsThisMonth = customerList.filter(c => {
      if (!c.renewal_date) return false;
      const renewalDate = new Date(c.renewal_date);
      return renewalDate >= startOfMonth && renewalDate < endOfMonth;
    }).length;

    // Get pending tasks count
    const { count: pendingTasksCount } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    // Get pending approvals count
    const { count: pendingApprovalsCount } = await supabase
      .from('pending_actions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    return {
      totalCustomers,
      totalArr,
      avgHealthScore,
      atRiskCount,
      renewalsThisMonth,
      pendingTasksCount: pendingTasksCount || 0,
      pendingApprovalsCount: pendingApprovalsCount || 0,
    };
  }

  /**
   * Get notification summary
   */
  async getNotificationSummary(userId: string, limit: number = 5): Promise<NotificationSummary[]> {
    if (!supabase) {
      return this.getMockNotifications(limit);
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, priority, customer_id, created_at')
      .eq('user_id', userId)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return (data || []).map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      priority: n.priority,
      customerId: n.customer_id,
      createdAt: n.created_at,
    }));
  }

  /**
   * Get widget data with caching
   */
  async getWidgetData(
    userId: string,
    widgetType: WidgetType,
    config?: WidgetConfig
  ): Promise<WidgetDataResponse> {
    const cacheKey = `${userId}:${widgetType}`;
    const cached = this.widgetCache.get(cacheKey);

    if (cached && cached.expiry > new Date()) {
      return cached.data;
    }

    const now = new Date();
    const cacheExpiry = new Date(now.getTime() + this.CACHE_TTL_MS);
    let response: WidgetDataResponse = {
      lastUpdated: now.toISOString(),
      cacheExpiry: cacheExpiry.toISOString(),
    };

    switch (widgetType) {
      case 'customer_quick_view':
        response.customers = await this.getPriorityCustomers(
          userId,
          5,
          config?.settings?.customerIds
        );
        break;

      case 'portfolio_overview':
        response.portfolio = await this.getPortfolioOverview(userId);
        break;

      case 'tasks_today':
        response.tasks = await this.getTasksToday(userId);
        break;

      case 'notification_summary':
        response.notifications = await this.getNotificationSummary(userId);
        break;

      case 'quick_compose':
        // Quick compose just needs customer list for selection
        response.customers = await this.getPriorityCustomers(userId, 10);
        break;
    }

    this.widgetCache.set(cacheKey, { data: response, expiry: cacheExpiry });
    return response;
  }

  /**
   * Execute a quick action
   */
  async executeQuickAction(
    userId: string,
    actionType: QuickActionType,
    params: Record<string, any>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      switch (actionType) {
        case 'quick_note':
          return await this.createQuickNote(userId, params as QuickNoteInput);

        case 'check_health':
          return await this.checkCustomerHealth(params.customerId);

        case 'create_task':
          return await this.createQuickTask(userId, params as QuickTaskInput);

        case 'voice_note':
          return await this.createVoiceNote(userId, params as QuickNoteInput);

        case 'call_contact':
          return await this.initiateCall(params.customerId);

        default:
          return { success: false, error: `Unknown action type: ${actionType}` };
      }
    } catch (error) {
      console.error(`Quick action ${actionType} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Action failed',
      };
    }
  }

  /**
   * Create a quick note for a customer
   */
  private async createQuickNote(
    userId: string,
    input: QuickNoteInput
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    if (!supabase) {
      console.log('[Mock] Created quick note:', input);
      return { success: true, result: { id: `note_${Date.now()}` } };
    }

    const { data, error } = await supabase
      .from('customer_notes')
      .insert({
        customer_id: input.customerId,
        user_id: userId,
        content: input.content,
        is_voice_note: input.isVoiceNote || false,
        audio_url: input.audioUrl,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, result: { id: data.id } };
  }

  /**
   * Get customer health score and details
   */
  private async checkCustomerHealth(
    customerId: string
  ): Promise<{ success: boolean; result?: CustomerSummary; error?: string }> {
    if (!supabase) {
      return {
        success: true,
        result: this.getMockPriorityCustomers(1)[0],
      };
    }

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, health_score, arr, renewal_date, status')
      .eq('id', customerId)
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || 'Customer not found' };
    }

    const trend = await this.calculateHealthTrend(customerId);
    const contact = await this.getPrimaryContact(customerId);

    return {
      success: true,
      result: {
        id: data.id,
        name: data.name,
        healthScore: data.health_score || 0,
        healthTrend: trend,
        arr: data.arr || 0,
        renewalDate: data.renewal_date,
        isAtRisk: (data.health_score || 0) < 40 || data.status === 'at_risk',
        primaryContactEmail: contact?.email,
        primaryContactPhone: contact?.phone,
      },
    };
  }

  /**
   * Create a quick task
   */
  private async createQuickTask(
    userId: string,
    input: QuickTaskInput
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    if (!supabase) {
      console.log('[Mock] Created quick task:', input);
      return { success: true, result: { id: `task_${Date.now()}` } };
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        customer_id: input.customerId,
        title: input.title,
        due_date: input.dueDate || new Date().toISOString().split('T')[0],
        priority: input.priority || 'medium',
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, result: { id: data.id } };
  }

  /**
   * Create a voice note (similar to quick note but with audio)
   */
  private async createVoiceNote(
    userId: string,
    input: QuickNoteInput
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    return this.createQuickNote(userId, {
      ...input,
      isVoiceNote: true,
    });
  }

  /**
   * Get primary contact for initiating a call
   */
  private async initiateCall(
    customerId: string
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const contact = await this.getPrimaryContact(customerId);

    if (!contact?.phone) {
      return { success: false, error: 'No phone number available for primary contact' };
    }

    return {
      success: true,
      result: {
        phone: contact.phone,
        name: contact.name,
        email: contact.email,
        callUrl: `tel:${contact.phone.replace(/\D/g, '')}`,
      },
    };
  }

  /**
   * Get widget configuration for a user
   */
  async getWidgetConfigs(userId: string): Promise<WidgetConfig[]> {
    if (!supabase) {
      return this.getMockWidgetConfigs(userId);
    }

    const { data, error } = await supabase
      .from('widget_configs')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching widget configs:', error);
      return [];
    }

    return (data || []).map(w => ({
      id: w.id,
      userId: w.user_id,
      widgetType: w.widget_type,
      size: w.size,
      position: w.position,
      settings: w.settings || {},
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    }));
  }

  /**
   * Save widget configuration
   */
  async saveWidgetConfig(
    userId: string,
    config: Partial<WidgetConfig>
  ): Promise<{ success: boolean; config?: WidgetConfig; error?: string }> {
    if (!supabase) {
      const mockConfig: WidgetConfig = {
        id: config.id || `widget_${Date.now()}`,
        userId,
        widgetType: config.widgetType || 'customer_quick_view',
        size: config.size || 'medium',
        position: config.position || 0,
        settings: config.settings || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { success: true, config: mockConfig };
    }

    const upsertData = {
      user_id: userId,
      widget_type: config.widgetType,
      size: config.size || 'medium',
      position: config.position || 0,
      settings: config.settings || {},
      updated_at: new Date().toISOString(),
    };

    if (config.id) {
      const { data, error } = await supabase
        .from('widget_configs')
        .update(upsertData)
        .eq('id', config.id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        config: {
          id: data.id,
          userId: data.user_id,
          widgetType: data.widget_type,
          size: data.size,
          position: data.position,
          settings: data.settings,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      };
    }

    const { data, error } = await supabase
      .from('widget_configs')
      .insert({
        ...upsertData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      config: {
        id: data.id,
        userId: data.user_id,
        widgetType: data.widget_type,
        size: data.size,
        position: data.position,
        settings: data.settings,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  }

  /**
   * Delete a widget configuration
   */
  async deleteWidgetConfig(userId: string, configId: string): Promise<boolean> {
    if (!supabase) {
      return true;
    }

    const { error } = await supabase
      .from('widget_configs')
      .delete()
      .eq('id', configId)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Clear widget cache for a user
   */
  clearCache(userId: string): void {
    for (const key of this.widgetCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.widgetCache.delete(key);
      }
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async calculateHealthTrend(customerId: string): Promise<'up' | 'down' | 'stable'> {
    if (!supabase) {
      return 'stable';
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('health_score_history')
      .select('score, recorded_at')
      .eq('customer_id', customerId)
      .gte('recorded_at', sevenDaysAgo)
      .order('recorded_at', { ascending: true })
      .limit(10);

    if (!data || data.length < 2) {
      return 'stable';
    }

    const firstScore = data[0].score;
    const lastScore = data[data.length - 1].score;
    const diff = lastScore - firstScore;

    if (diff > 5) return 'up';
    if (diff < -5) return 'down';
    return 'stable';
  }

  private async getPrimaryContact(
    customerId: string
  ): Promise<{ name: string; email: string; phone?: string } | null> {
    if (!supabase) {
      return { name: 'John Doe', email: 'john@example.com', phone: '+1-555-0123' };
    }

    const { data } = await supabase
      .from('stakeholders')
      .select('name, email, phone')
      .eq('customer_id', customerId)
      .eq('is_primary', true)
      .single();

    return data;
  }

  // ============================================
  // Mock Data Methods
  // ============================================

  private getMockPriorityCustomers(limit: number): CustomerSummary[] {
    const mockCustomers: CustomerSummary[] = [
      {
        id: 'cust_001',
        name: 'Acme Corp',
        healthScore: 35,
        healthTrend: 'down',
        arr: 150000,
        renewalDate: '2026-03-15',
        isAtRisk: true,
        primaryContactEmail: 'sarah@acme.com',
        primaryContactPhone: '+1-555-0101',
      },
      {
        id: 'cust_002',
        name: 'TechStart Inc',
        healthScore: 78,
        healthTrend: 'up',
        arr: 85000,
        renewalDate: '2026-04-01',
        isAtRisk: false,
        primaryContactEmail: 'mike@techstart.io',
        primaryContactPhone: '+1-555-0102',
      },
      {
        id: 'cust_003',
        name: 'Global Solutions',
        healthScore: 52,
        healthTrend: 'stable',
        arr: 220000,
        renewalDate: '2026-02-28',
        isAtRisk: false,
        primaryContactEmail: 'emma@globalsolutions.com',
        primaryContactPhone: '+1-555-0103',
      },
      {
        id: 'cust_004',
        name: 'DataFlow Ltd',
        healthScore: 28,
        healthTrend: 'down',
        arr: 95000,
        renewalDate: '2026-02-15',
        isAtRisk: true,
        primaryContactEmail: 'james@dataflow.io',
        primaryContactPhone: '+1-555-0104',
      },
      {
        id: 'cust_005',
        name: 'CloudNine Systems',
        healthScore: 91,
        healthTrend: 'up',
        arr: 175000,
        renewalDate: '2026-06-01',
        isAtRisk: false,
        primaryContactEmail: 'lisa@cloudnine.com',
        primaryContactPhone: '+1-555-0105',
      },
    ];

    return mockCustomers.slice(0, limit);
  }

  private getMockTasksToday(limit: number): TaskSummary[] {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const mockTasks: TaskSummary[] = [
      {
        id: 'task_001',
        title: 'Follow up with Acme Corp on support ticket',
        dueDate: today,
        priority: 'high',
        customerId: 'cust_001',
        customerName: 'Acme Corp',
        isOverdue: false,
      },
      {
        id: 'task_002',
        title: 'Prepare QBR presentation',
        dueDate: today,
        priority: 'urgent',
        customerId: 'cust_003',
        customerName: 'Global Solutions',
        isOverdue: false,
      },
      {
        id: 'task_003',
        title: 'Review contract renewal terms',
        dueDate: yesterday,
        priority: 'high',
        customerId: 'cust_004',
        customerName: 'DataFlow Ltd',
        isOverdue: true,
      },
      {
        id: 'task_004',
        title: 'Schedule onboarding call',
        dueDate: today,
        priority: 'medium',
        customerId: 'cust_002',
        customerName: 'TechStart Inc',
        isOverdue: false,
      },
      {
        id: 'task_005',
        title: 'Send feature adoption report',
        dueDate: today,
        priority: 'low',
        customerId: 'cust_005',
        customerName: 'CloudNine Systems',
        isOverdue: false,
      },
    ];

    return mockTasks.slice(0, limit);
  }

  private getMockPortfolioOverview(): PortfolioOverview {
    return {
      totalCustomers: 42,
      totalArr: 3850000,
      avgHealthScore: 68,
      atRiskCount: 5,
      renewalsThisMonth: 3,
      pendingTasksCount: 12,
      pendingApprovalsCount: 4,
    };
  }

  private getMockNotifications(limit: number): NotificationSummary[] {
    const mockNotifications: NotificationSummary[] = [
      {
        id: 'notif_001',
        type: 'health_alert',
        title: 'Health Score Drop',
        body: 'Acme Corp health score dropped 15 points',
        priority: 'high',
        customerId: 'cust_001',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'notif_002',
        type: 'renewal_reminder',
        title: 'Renewal in 30 Days',
        body: 'DataFlow Ltd renewal coming up',
        priority: 'medium',
        customerId: 'cust_004',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'notif_003',
        type: 'approval_required',
        title: 'Action Pending Approval',
        body: 'Email draft to TechStart Inc ready for review',
        priority: 'medium',
        customerId: 'cust_002',
        createdAt: new Date(Date.now() - 10800000).toISOString(),
      },
    ];

    return mockNotifications.slice(0, limit);
  }

  private getMockWidgetConfigs(userId: string): WidgetConfig[] {
    return [
      {
        id: 'widget_001',
        userId,
        widgetType: 'customer_quick_view',
        size: 'medium',
        position: 0,
        settings: {
          customerIds: ['cust_001', 'cust_004'],
          defaultAction: 'quick_note',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'widget_002',
        userId,
        widgetType: 'tasks_today',
        size: 'small',
        position: 1,
        settings: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'widget_003',
        userId,
        widgetType: 'portfolio_overview',
        size: 'small',
        position: 2,
        settings: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

// Export singleton instance
export const quickActionsService = new QuickActionsService();

export default quickActionsService;
