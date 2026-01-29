import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { AgentMessage } from '../agents/base.js';

export class SupabaseService {
  private client: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.client = createClient(
        config.supabaseUrl,
        config.supabaseServiceKey
      );
    }
  }

  private ensureClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
    }
    return this.client;
  }

  // Sessions
  async createSession(customerId: string, userId?: string): Promise<{ id: string }> {
    if (!this.client) {
      return { id: `session_${Date.now()}` };
    }

    const { data, error } = await this.ensureClient()
      .from('agent_sessions')
      .insert({
        customer_id: customerId,
        user_id: userId,
        status: 'active'
      })
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  async getSession(sessionId: string): Promise<Record<string, unknown> | null> {
    if (!this.client) return null;

    const { data, error } = await this.ensureClient()
      .from('agent_sessions')
      .select('*, agent_messages(*)')
      .eq('id', sessionId)
      .single();

    if (error) return null;
    return data;
  }

  // Messages
  async insertMessage(message: AgentMessage): Promise<void> {
    if (!this.client) {
      console.log('Message (no DB):', message);
      return;
    }

    const { error } = await this.ensureClient()
      .from('agent_messages')
      .insert({
        session_id: message.sessionId,
        agent_id: message.agentId,
        role: message.role,
        content: message.content,
        thinking: message.thinking || false,
        requires_approval: message.requiresApproval || false,
        deployed_agent: message.deployedAgent,
        tool_calls: message.toolCalls
      });

    if (error) {
      console.error('Failed to save message:', error);
    }
  }

  async getMessages(sessionId: string): Promise<AgentMessage[]> {
    if (!this.client) return [];

    const { data, error } = await this.ensureClient()
      .from('agent_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) return [];

    return data.map(m => ({
      id: m.id,
      sessionId: m.session_id,
      agentId: m.agent_id,
      role: m.role,
      content: m.content,
      thinking: m.thinking,
      requiresApproval: m.requires_approval,
      deployedAgent: m.deployed_agent,
      toolCalls: m.tool_calls,
      timestamp: new Date(m.created_at)
    }));
  }

  // Customers
  async getCustomer(id: string): Promise<Record<string, unknown> | null> {
    if (!this.client) return null;

    const { data, error } = await this.ensureClient()
      .from('customers')
      .select('*, stakeholders(*), contracts(*)')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async getCustomerByName(name: string): Promise<Record<string, unknown> | null> {
    if (!this.client) return null;

    const { data, error } = await this.ensureClient()
      .from('customers')
      .select('*, stakeholders(*), contracts(*)')
      .ilike('name', `%${name}%`)
      .single();

    if (error) return null;
    return data;
  }

  async createCustomer(customer: Record<string, unknown>): Promise<{ id: string }> {
    if (!this.client) {
      return { id: `cust_${Date.now()}` };
    }

    const { data, error } = await this.ensureClient()
      .from('customers')
      .insert(customer)
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  // Approvals
  async createApproval(approval: Record<string, unknown>): Promise<{ id: string }> {
    if (!this.client) {
      return { id: `approval_${Date.now()}` };
    }

    const { data, error } = await this.ensureClient()
      .from('approvals')
      .insert(approval)
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  async updateApproval(id: string, updates: Record<string, unknown>): Promise<void> {
    if (!this.client) return;

    const { error } = await this.ensureClient()
      .from('approvals')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  }

  async getPendingApprovals(sessionId?: string): Promise<Array<Record<string, unknown>>> {
    if (!this.client) return [];

    let query = this.ensureClient()
      .from('approvals')
      .select('*')
      .eq('status', 'pending');

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) return [];
    return data;
  }

  // Contracts
  async saveContract(contract: Record<string, unknown>): Promise<{ id: string }> {
    if (!this.client) {
      return { id: `contract_${Date.now()}` };
    }

    const { data, error } = await this.ensureClient()
      .from('contracts')
      .insert(contract)
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  async getContract(id: string): Promise<Record<string, unknown> | null> {
    if (!this.client) return null;

    const { data, error } = await this.ensureClient()
      .from('contracts')
      .select('*, entitlements(*)')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async listContracts(options?: {
    customerId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ contracts: Array<Record<string, unknown>>; total: number }> {
    if (!this.client) {
      return { contracts: [], total: 0 };
    }

    let query = this.ensureClient()
      .from('contracts')
      .select('*, customers(name)', { count: 'exact' });

    if (options?.customerId) {
      query = query.eq('customer_id', options.customerId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.search) {
      query = query.or(`company_name.ilike.%${options.search}%,file_name.ilike.%${options.search}%`);
    }

    query = query.order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options?.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error listing contracts:', error);
      return { contracts: [], total: 0 };
    }

    return { contracts: data || [], total: count || 0 };
  }

  // Meetings
  async createMeeting(meeting: Record<string, unknown>): Promise<{ id: string }> {
    if (!this.client) {
      return { id: `meeting_${Date.now()}` };
    }

    const { data, error } = await this.ensureClient()
      .from('meetings')
      .insert(meeting)
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  // Insights
  async saveInsight(insight: Record<string, unknown>): Promise<{ id: string }> {
    if (!this.client) {
      return { id: `insight_${Date.now()}` };
    }

    const { data, error } = await this.ensureClient()
      .from('insights')
      .insert(insight)
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  async getCustomerInsights(customerId: string): Promise<Array<Record<string, unknown>>> {
    if (!this.client) return [];

    const { data, error } = await this.ensureClient()
      .from('insights')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data;
  }

  // Storage
  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer,
    contentType: string
  ): Promise<{ url: string } | null> {
    if (!this.client) {
      console.log('Storage (no client configured): would upload to', path);
      return null;
    }

    const { error: uploadError } = await this.ensureClient()
      .storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data } = this.ensureClient()
      .storage
      .from(bucket)
      .getPublicUrl(path);

    return { url: data.publicUrl };
  }

  async updateContract(id: string, updates: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      console.log('Update contract (no client):', id, updates);
      return;
    }

    const { error } = await this.ensureClient()
      .from('contracts')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating contract:', error);
      throw error;
    }
  }
}
