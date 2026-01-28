/**
 * Streaming Types
 * Shared types for SSE streaming between server and client
 */

/**
 * Types for SSE streaming events
 */
export interface StreamEvent {
  type: 'token' | 'tool_start' | 'tool_end' | 'thinking' | 'done' | 'error';
  content?: string;
  name?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  duration?: number;
  error?: string;
}

/**
 * Streaming state for UI components
 */
export interface StreamingState {
  isStreaming: boolean;
  content: string;
  toolsInProgress: string[];
  error?: string;
}
