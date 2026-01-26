/**
 * CSCX.AI Agent API Service
 * Connects frontend to backend agent system
 */

const API_URL = import.meta.env.VITE_API_URL || '';

export interface AgentMessage {
  id: string;
  sessionId: string;
  agentId?: string;
  message: string;
  metadata: {
    thinking: boolean;
    requiresApproval: boolean;
    deployedAgent: string | null;
  };
  timestamp: string;
}

export interface CustomerContext {
  name: string;
  arr: string | number;
  products?: string[];
  stakeholders?: string[];
}

export interface Session {
  sessionId: string;
  customerId: string;
  status: string;
  createdAt: string;
}

class AgentApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  /**
   * Create a new agent session
   */
  async createSession(customerId?: string, context?: CustomerContext): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/api/agents/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, context })
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    return response.json();
  }

  /**
   * Send a message to the agent
   */
  async sendMessage(
    sessionId: string,
    message: string,
    context?: CustomerContext
  ): Promise<AgentMessage> {
    const response = await fetch(`${this.baseUrl}/api/agents/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message, context })
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  }

  /**
   * Get session history
   */
  async getSession(sessionId: string): Promise<{ messages: AgentMessage[] }> {
    const response = await fetch(`${this.baseUrl}/api/agents/sessions/${sessionId}`);

    if (!response.ok) {
      throw new Error('Failed to get session');
    }

    return response.json();
  }

  /**
   * Deploy a specific subagent
   */
  async deployAgent(
    sessionId: string,
    agentId: 'meeting' | 'training' | 'intelligence',
    message?: string,
    context?: CustomerContext
  ): Promise<AgentMessage> {
    const response = await fetch(`${this.baseUrl}/api/agents/deploy/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message, context })
    });

    if (!response.ok) {
      throw new Error('Failed to deploy agent');
    }

    return response.json();
  }

  /**
   * Approve or reject an agent action
   */
  async handleApproval(
    approvalId: string,
    approved: boolean,
    comment?: string
  ): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/api/agents/approve/${approvalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, comment })
    });

    if (!response.ok) {
      throw new Error('Failed to process approval');
    }

    return response.json();
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(): Promise<{ approvals: Array<Record<string, unknown>> }> {
    const response = await fetch(`${this.baseUrl}/api/agents/pending`);

    if (!response.ok) {
      throw new Error('Failed to get pending approvals');
    }

    return response.json();
  }

  /**
   * Parse a contract document
   */
  async parseContract(content: string, type: 'text' | 'file' = 'text'): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/api/contracts/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, type })
    });

    if (!response.ok) {
      throw new Error('Failed to parse contract');
    }

    return response.json();
  }

  /**
   * Get customer details
   */
  async getCustomer(id: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/api/customers/${id}`);

    if (!response.ok) {
      throw new Error('Failed to get customer');
    }

    return response.json();
  }

  /**
   * Get customer health score
   */
  async getHealthScore(customerId: string): Promise<{
    overall: number;
    components: Record<string, number>;
    risks: Array<{ category: string; description: string; severity: string }>;
  }> {
    const response = await fetch(`${this.baseUrl}/api/customers/${customerId}/health`);

    if (!response.ok) {
      throw new Error('Failed to get health score');
    }

    return response.json();
  }

  /**
   * Check API health
   */
  async checkHealth(): Promise<{ status: string; version: string }> {
    const response = await fetch(`${this.baseUrl}/health`);

    if (!response.ok) {
      throw new Error('API is not healthy');
    }

    return response.json();
  }
}

// Singleton instance
export const agentApi = new AgentApiService();
export default agentApi;
