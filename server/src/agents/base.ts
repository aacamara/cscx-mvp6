import { GeminiService } from '../services/gemini.js';
import { ClaudeService } from '../services/claude.js';
import { SupabaseService } from '../services/supabase.js';

export type AgentId = 'onboarding' | 'meeting' | 'training' | 'intelligence';

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

export interface ToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  model: 'gemini' | 'claude';
  systemPrompt: string;
  tools: Tool[];
  requiresApproval: string[];
}

export interface CustomerContext {
  id?: string;
  name: string;
  arr?: number | string;
  stage?: string;
  stakeholders?: string[];
  products?: string[];
  meetingId?: string;
}

export interface AgentMessage {
  id?: string;
  sessionId: string;
  agentId?: AgentId;
  role: 'user' | 'agent' | 'system';
  content: string;
  thinking?: boolean;
  requiresApproval?: boolean;
  deployedAgent?: AgentId;
  toolCalls?: ToolCall[];
  timestamp?: Date;
}

export interface AgentInput {
  sessionId: string;
  message: string;
  context: CustomerContext;
  history: AgentMessage[];
}

export interface AgentOutput {
  message: string;
  thinking?: boolean;
  requiresApproval?: boolean;
  deployAgent?: AgentId;
  toolCalls?: ToolCall[];
  data?: Record<string, unknown>;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected gemini: GeminiService;
  protected claude: ClaudeService;
  protected db: SupabaseService;

  constructor(config: AgentConfig) {
    this.config = config;
    this.gemini = new GeminiService();
    this.claude = new ClaudeService();
    this.db = new SupabaseService();
  }

  abstract execute(input: AgentInput): Promise<AgentOutput>;

  protected async think(prompt: string): Promise<string> {
    if (this.config.model === 'claude') {
      return this.claude.generate(prompt, this.config.systemPrompt);
    }
    return this.gemini.generate(prompt, this.config.systemPrompt);
  }

  protected async saveMessage(message: AgentMessage): Promise<void> {
    await this.db.insertMessage(message);
  }

  protected needsApproval(action: string): boolean {
    return this.config.requiresApproval.includes(action);
  }

  public getId(): AgentId {
    return this.config.id;
  }

  public getName(): string {
    return this.config.name;
  }
}
