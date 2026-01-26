/**
 * WebSocket Context
 * Provides real-time updates from the backend for agent execution
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

interface AgentEvent {
  id: string;
  type: 'run:start' | 'run:end' | 'step' | 'approval_required' | 'agent_message';
  runId?: string;
  agentName?: string;
  status?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp: string;
  read?: boolean;
}

interface WebSocketContextValue {
  connected: boolean;
  events: AgentEvent[];
  unreadCount: number;
  markAsRead: (eventId: string) => void;
  markAllAsRead: () => void;
  clearEvents: () => void;
  pendingApprovals: AgentEvent[];
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      console.log('[WebSocket] Attempting to connect to:', WS_URL);
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setConnected(true);

        // Authenticate (in production, use actual token)
        ws.send(JSON.stringify({
          type: 'auth',
          data: { token: 'demo-token' }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setConnected(false);

        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err);
      };
    } catch (err) {
      console.error('[WebSocket] Connection failed:', err);
    }
  }, []);

  const handleMessage = (message: { type: string; data: Record<string, unknown> }) => {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    switch (message.type) {
      case 'connected':
        console.log('[WebSocket] Server acknowledged connection');
        break;

      case 'authenticated':
        console.log('[WebSocket] Authenticated as:', message.data.userId);
        break;

      case 'trace:run:start':
        setEvents(prev => [{
          id: eventId,
          type: 'run:start' as const,
          runId: message.data.runId as string,
          agentName: message.data.agentName as string,
          message: `Agent "${message.data.agentName}" started executing`,
          data: message.data,
          timestamp: message.data.timestamp as string || new Date().toISOString(),
          read: false,
        }, ...prev].slice(0, 50)); // Keep last 50 events
        break;

      case 'trace:run:end':
        setEvents(prev => [{
          id: eventId,
          type: 'run:end' as const,
          runId: message.data.runId as string,
          status: message.data.status as string,
          message: message.data.status === 'completed'
            ? `Agent completed successfully`
            : `Agent finished with status: ${message.data.status}`,
          data: message.data,
          timestamp: message.data.timestamp as string || new Date().toISOString(),
          read: false,
        }, ...prev].slice(0, 50));
        break;

      case 'agent:step':
        setEvents(prev => [{
          id: eventId,
          type: 'step' as const,
          runId: message.data.runId as string,
          message: `Executed: ${message.data.name}`,
          data: message.data,
          timestamp: message.data.timestamp as string || new Date().toISOString(),
          read: false,
        }, ...prev].slice(0, 50));
        break;

      case 'approval_required':
        setEvents(prev => [{
          id: eventId,
          type: 'approval_required' as const,
          message: `Approval needed: ${message.data.actionType || 'Agent action'}`,
          data: message.data,
          timestamp: new Date().toISOString(),
          read: false,
        }, ...prev].slice(0, 50));
        break;

      case 'agent_message':
        setEvents(prev => [{
          id: eventId,
          type: 'agent_message' as const,
          agentName: message.data.agentId as string,
          message: message.data.message as string,
          data: message.data,
          timestamp: message.data.timestamp as string || new Date().toISOString(),
          read: false,
        }, ...prev].slice(0, 50));
        break;

      default:
        // Ignore other message types
        break;
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const markAsRead = useCallback((eventId: string) => {
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, read: true } : e
    ));
  }, []);

  const markAllAsRead = useCallback(() => {
    setEvents(prev => prev.map(e => ({ ...e, read: true })));
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const unreadCount = events.filter(e => !e.read).length;
  const pendingApprovals = events.filter(e => e.type === 'approval_required' && !e.read);

  return (
    <WebSocketContext.Provider value={{
      connected,
      events,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearEvents,
      pendingApprovals,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;
