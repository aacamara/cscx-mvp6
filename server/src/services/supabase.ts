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

    // Build insert object with only fields that exist
    // Required fields
    const insertData: Record<string, unknown> = {
      file_name: contract.file_name,
      company_name: contract.company_name,
      arr: contract.arr,
      status: contract.status || 'active',
    };

    // Copy optional fields if they exist
    const optionalFields = [
      'customer_id', 'file_type', 'file_size', 'file_url', 'google_doc_url',
      'raw_text', 'contract_period', 'contract_term', 'parsed_data', 'confidence',
      'parsed_at'
    ];
    for (const field of optionalFields) {
      if (contract[field] !== undefined) {
        insertData[field] = contract[field];
      }
    }

    // Try to insert with optional date/value columns first
    // If it fails due to missing columns, retry without them
    const extendedData = { ...insertData };
    if (contract.total_value !== undefined) extendedData.total_value = contract.total_value;
    if (contract.start_date !== undefined) extendedData.start_date = contract.start_date;
    if (contract.end_date !== undefined) extendedData.end_date = contract.end_date;

    const { data, error } = await this.ensureClient()
      .from('contracts')
      .insert(extendedData)
      .select('id')
      .single();

    if (error) {
      // Check if error is due to missing columns
      if (error.message?.includes('total_value') ||
          error.message?.includes('start_date') ||
          error.message?.includes('end_date')) {
        console.warn('[Supabase] Optional columns missing, retrying without them:', error.message);
        // Retry without the optional date/value columns
        const { data: retryData, error: retryError } = await this.ensureClient()
          .from('contracts')
          .insert(insertData)
          .select('id')
          .single();

        if (retryError) throw retryError;
        return retryData;
      }
      throw error;
    }
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

  // Entitlements
  async saveEntitlement(entitlement: Record<string, unknown>): Promise<{ id: string }> {
    if (!this.client) {
      return { id: `entitlement_${Date.now()}` };
    }

    const { data, error } = await this.ensureClient()
      .from('entitlements')
      .insert(entitlement)
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  async getEntitlementsByContract(contractId: string): Promise<Array<Record<string, unknown>>> {
    if (!this.client) return [];

    const { data, error } = await this.ensureClient()
      .from('entitlements')
      .select('*')
      .eq('contract_id', contractId);

    if (error) return [];
    return data;
  }

  async getEntitlementsByCustomer(customerId: string): Promise<Array<Record<string, unknown>>> {
    if (!this.client) return [];

    const { data, error } = await this.ensureClient()
      .from('entitlements')
      .select('*, contracts(*)')
      .eq('customer_id', customerId);

    if (error) return [];
    return data;
  }

  // PRD-0: Enhanced Entitlements Methods

  async listEntitlements(options?: {
    customerId?: string;
    contractId?: string;
    status?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ entitlements: Array<Record<string, unknown>>; total: number }> {
    if (!this.client) {
      return { entitlements: [], total: 0 };
    }

    let query = this.ensureClient()
      .from('entitlements')
      .select('*, contracts(file_name, status), customers(name)', { count: 'exact' });

    if (options?.customerId) {
      query = query.eq('customer_id', options.customerId);
    }
    if (options?.contractId) {
      query = query.eq('contract_id', options.contractId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
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
      console.error('Error listing entitlements:', error);
      return { entitlements: [], total: 0 };
    }

    return { entitlements: data || [], total: count || 0 };
  }

  async getEntitlement(id: string): Promise<Record<string, unknown> | null> {
    if (!this.client) return null;

    const { data, error } = await this.ensureClient()
      .from('entitlements')
      .select('*, contracts(file_name, file_url, status, parsed_data), customers(name)')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async updateEntitlement(id: string, updates: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      console.log('Update entitlement (no client):', id, updates);
      return;
    }

    const { error } = await this.ensureClient()
      .from('entitlements')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating entitlement:', error);
      throw error;
    }
  }

  async saveEntitlementEdit(edit: {
    entitlement_id: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    edited_by?: string;
  }): Promise<{ id: string }> {
    if (!this.client) {
      return { id: `edit_${Date.now()}` };
    }

    const { data, error } = await this.ensureClient()
      .from('entitlement_edits')
      .insert(edit)
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  async getEntitlementEdits(entitlementId: string): Promise<Array<Record<string, unknown>>> {
    if (!this.client) return [];

    const { data, error } = await this.ensureClient()
      .from('entitlement_edits')
      .select('*')
      .eq('entitlement_id', entitlementId)
      .order('edited_at', { ascending: false });

    if (error) return [];
    return data;
  }

  async finalizeEntitlement(id: string, userId?: string): Promise<Record<string, unknown>> {
    if (!this.client) {
      return { id, version: 1, status: 'finalized', is_active: true };
    }

    // Get current entitlement to get version
    const current = await this.getEntitlement(id);
    if (!current) {
      throw new Error('Entitlement not found');
    }

    const currentVersion = (current.version as number) || 1;

    // Deactivate any previously active version for same contract + same SKU
    if (current.contract_id && current.sku) {
      await this.ensureClient()
        .from('entitlements')
        .update({ is_active: false })
        .eq('contract_id', current.contract_id)
        .eq('sku', current.sku)
        .eq('is_active', true)
        .neq('id', id);
    }

    // Update the entitlement
    const updates: Record<string, unknown> = {
      status: 'finalized',
      is_active: true,
      version: currentVersion + 1,
      finalized_at: new Date().toISOString()
    };

    if (userId) {
      updates.finalized_by = userId;
    }

    const { data, error } = await this.ensureClient()
      .from('entitlements')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async getEntitlementVersionHistory(entitlementId: string): Promise<{
    entitlement: Record<string, unknown> | null;
    edits: Array<Record<string, unknown>>;
  }> {
    const entitlement = await this.getEntitlement(entitlementId);
    const edits = await this.getEntitlementEdits(entitlementId);

    return { entitlement, edits };
  }
}
