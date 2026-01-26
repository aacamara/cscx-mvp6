import { WebSocketServer, WebSocket } from 'ws';

interface WSMessage {
  type: string;
  data: Record<string, unknown>;
}

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
  isAlive?: boolean;
}

export class WebSocketHandler {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedSocket> = new Map();

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.setupServer();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: AuthenticatedSocket) => {
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid message format' }
          }));
        }
      });

      ws.on('close', () => {
        if (ws.userId) {
          this.clients.delete(ws.userId);
        }
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        data: { message: 'Connected to CSCX.AI WebSocket' }
      }));
    });

    // Heartbeat to detect stale connections
    setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const socket = ws as AuthenticatedSocket;
        if (socket.isAlive === false) {
          return socket.terminate();
        }
        socket.isAlive = false;
        socket.ping();
      });
    }, 30000);
  }

  private handleMessage(ws: AuthenticatedSocket, message: WSMessage): void {
    switch (message.type) {
      case 'auth':
        this.handleAuth(ws, message.data);
        break;

      case 'subscribe':
        this.handleSubscribe(ws, message.data);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(ws, message.data);
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` }
        }));
    }
  }

  private handleAuth(ws: AuthenticatedSocket, data: Record<string, unknown>): void {
    // In production, validate token with Supabase
    const token = data.token as string;
    if (token) {
      ws.userId = `user_${Date.now()}`;
      this.clients.set(ws.userId, ws);

      ws.send(JSON.stringify({
        type: 'authenticated',
        data: { userId: ws.userId }
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Authentication failed' }
      }));
    }
  }

  private handleSubscribe(ws: AuthenticatedSocket, data: Record<string, unknown>): void {
    const sessionId = data.sessionId as string;
    if (sessionId) {
      ws.sessionId = sessionId;
      ws.send(JSON.stringify({
        type: 'subscribed',
        data: { sessionId }
      }));
    }
  }

  private handleUnsubscribe(ws: AuthenticatedSocket, data: Record<string, unknown>): void {
    ws.sessionId = undefined;
    ws.send(JSON.stringify({
      type: 'unsubscribed',
      data: {}
    }));
  }

  // Public methods to broadcast messages

  public broadcastToSession(sessionId: string, message: WSMessage): void {
    this.wss.clients.forEach((client: WebSocket) => {
      const socket = client as AuthenticatedSocket;
      if (socket.sessionId === sessionId && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    });
  }

  public broadcastAgentMessage(sessionId: string, agentId: string, content: string): void {
    this.broadcastToSession(sessionId, {
      type: 'agent_message',
      data: {
        sessionId,
        agentId,
        message: content,
        timestamp: new Date().toISOString()
      }
    });
  }

  public broadcastAgentDeployed(sessionId: string, agentId: string): void {
    this.broadcastToSession(sessionId, {
      type: 'agent_deployed',
      data: {
        sessionId,
        agentId,
        timestamp: new Date().toISOString()
      }
    });
  }

  public broadcastApprovalRequired(sessionId: string, approval: Record<string, unknown>): void {
    this.broadcastToSession(sessionId, {
      type: 'approval_required',
      data: approval
    });
  }

  public broadcastToUser(userId: string, message: WSMessage): void {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  // ============================================
  // Agent Trace Broadcasting
  // ============================================

  public broadcastTraceEvent(userId: string, event: {
    type: 'run:start' | 'run:end' | 'step:start' | 'step:end' | 'status:change';
    runId: string;
    data: Record<string, unknown>;
  }): void {
    // Broadcast to the specific user
    this.broadcastToUser(userId, {
      type: `trace:${event.type}`,
      data: {
        runId: event.runId,
        ...event.data,
        timestamp: new Date().toISOString()
      }
    });

    // Also broadcast to any session-based subscribers
    this.wss.clients.forEach((client: WebSocket) => {
      const socket = client as AuthenticatedSocket;
      if (socket.userId === userId && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: `trace:${event.type}`,
          data: {
            runId: event.runId,
            ...event.data,
            timestamp: new Date().toISOString()
          }
        }));
      }
    });
  }

  public broadcastAgentStep(userId: string, step: {
    runId: string;
    stepId: string;
    type: string;
    name: string;
    status: 'started' | 'completed' | 'error';
    input?: unknown;
    output?: unknown;
    duration?: number;
  }): void {
    this.broadcastToUser(userId, {
      type: 'agent:step',
      data: {
        ...step,
        timestamp: new Date().toISOString()
      }
    });
  }

  public broadcastAgentRunStatus(userId: string, run: {
    runId: string;
    agentName: string;
    status: string;
    input?: string;
    output?: string;
  }): void {
    this.broadcastToUser(userId, {
      type: 'agent:run',
      data: {
        ...run,
        timestamp: new Date().toISOString()
      }
    });
  }
}
