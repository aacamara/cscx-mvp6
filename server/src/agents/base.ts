import { GeminiService, StreamCallback, StreamResult } from '../services/gemini.js';
import { ClaudeService } from '../services/claude.js';
import { SupabaseService } from '../services/supabase.js';

export type { StreamCallback, StreamResult };
export type ThinkingCallback = () => void;

/**
 * Callback for tool execution events during streaming
 */
export type ToolEventCallback = (event: ToolEvent) => void;

/**
 * Tool execution event for streaming
 */
export interface ToolEvent {
  type: 'tool_start' | 'tool_end';
  name: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  duration?: number; // milliseconds
}

export type AgentId = 'onboarding' | 'meeting' | 'training' | 'intelligence' | 'cadg';

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

  /**
   * Generate a streaming response
   * @param prompt The prompt to send
   * @param onChunk Callback for each text chunk
   * @param signal Optional AbortSignal for cancellation
   * @param onThinking Optional callback when thinking block is detected (Claude only)
   * @returns StreamResult with complete text and token counts
   */
  protected async thinkStream(
    prompt: string,
    onChunk?: StreamCallback,
    signal?: AbortSignal,
    onThinking?: () => void
  ): Promise<StreamResult> {
    if (this.config.model === 'claude') {
      // Use Claude streaming API
      return this.claude.generateStream(
        prompt,
        this.config.systemPrompt,
        onChunk,
        onThinking,
        signal
      );
    }
    return this.gemini.generateStream(prompt, this.config.systemPrompt, onChunk, signal);
  }

  /**
   * Check if this agent supports streaming
   */
  public supportsStreaming(): boolean {
    // Both Claude and Gemini support streaming
    return this.config.model === 'gemini' || this.config.model === 'claude';
  }

  /**
   * Get the model type for this agent
   */
  public getModel(): 'gemini' | 'claude' {
    return this.config.model;
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
