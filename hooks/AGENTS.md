# Hooks - Agent Instructions

## Overview

Custom React hooks for shared logic across components.

## Available Hooks

| Hook | Purpose |
|------|---------|
| `useCustomer` | Fetch and manage single customer data |
| `useCustomers` | Fetch and manage customer list |
| `useAgentChat` | Agent chat session and messaging |
| `useApprovals` | HITL approval queue |
| `useGoogleAuth` | Google OAuth status and connection |
| `useHealthScore` | Customer health score data |
| `useWebSocket` | WebSocket connection management |

## Hook Patterns

### Data Fetching Hook
```typescript
// hooks/useCustomer.ts
import { useState, useEffect } from 'react';

interface UseCustomerResult {
  customer: Customer | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCustomer(id: string | undefined): UseCustomerResult {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomer = async () => {
    if (!id) {
      setCustomer(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/customers/${id}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch customer');
      }

      setCustomer(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  return { customer, loading, error, refetch: fetchCustomer };
}
```

### WebSocket Hook
```typescript
// hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  url?: string;
  onMessage?: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(options.url || '', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      options.onConnect?.();
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      options.onDisconnect?.();
    });

    socket.on('message', (data) => {
      options.onMessage?.(data);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const subscribe = useCallback((event: string, handler: (data: unknown) => void) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return { emit, subscribe, socket: socketRef.current };
}
```

### Agent Chat Hook
```typescript
// hooks/useAgentChat.ts
import { useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

interface UseAgentChatResult {
  messages: Message[];
  isStreaming: boolean;
  pendingApprovals: Approval[];
  sendMessage: (content: string) => Promise<void>;
  approveAction: (id: string) => Promise<void>;
  rejectAction: (id: string, reason: string) => Promise<void>;
}

export function useAgentChat(
  sessionId: string | null,
  customerId?: string
): UseAgentChatResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);

  const { emit, subscribe } = useWebSocket({
    onConnect: () => {
      if (sessionId) {
        emit('join:session', { sessionId });
      }
    }
  });

  // Subscribe to streaming events
  useEffect(() => {
    const unsubToken = subscribe('message:token', (data: { token: string }) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, content: last.content + data.token }];
        }
        return [...prev, { role: 'assistant', content: data.token }];
      });
    });

    const unsubApproval = subscribe('approval:created', (approval: Approval) => {
      setPendingApprovals(prev => [...prev, approval]);
    });

    return () => {
      unsubToken();
      unsubApproval();
    };
  }, [subscribe]);

  const sendMessage = useCallback(async (content: string) => {
    setMessages(prev => [...prev, { role: 'user', content, timestamp: new Date().toISOString() }]);
    setIsStreaming(true);

    try {
      const response = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: content, customerId })
      });

      const result = await response.json();
      // Response comes through WebSocket streaming
    } finally {
      setIsStreaming(false);
    }
  }, [sessionId, customerId]);

  return { messages, isStreaming, pendingApprovals, sendMessage, approveAction, rejectAction };
}
```

## Best Practices

### 1. Handle Loading States
```typescript
// ❌ BAD - no loading state
const { data } = useData();
return <div>{data.name}</div>; // Crashes if data is null

// ✅ GOOD - handle all states
const { data, loading, error } = useData();

if (loading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <EmptyState />;

return <div>{data.name}</div>;
```

### 2. Cleanup Effects
```typescript
// ❌ BAD - memory leak
useEffect(() => {
  const interval = setInterval(fetchData, 5000);
  // Missing cleanup!
}, []);

// ✅ GOOD - cleanup on unmount
useEffect(() => {
  const interval = setInterval(fetchData, 5000);
  return () => clearInterval(interval);
}, []);
```

### 3. Memoize Callbacks
```typescript
// ❌ BAD - new function every render
const handleClick = () => doSomething(id);

// ✅ GOOD - stable reference
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

### 4. Dependency Arrays
```typescript
// ❌ BAD - missing dependency
useEffect(() => {
  fetchData(customerId); // customerId not in deps
}, []);

// ✅ GOOD - complete dependencies
useEffect(() => {
  fetchData(customerId);
}, [customerId]);
```
