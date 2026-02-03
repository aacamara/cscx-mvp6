# Server Source - Agent Instructions

## Overview

Express.js backend with TypeScript. Handles API routes, WebSocket connections, agent orchestration, and Google Workspace integration.

## Directory Structure

```
server/src/
├── index.ts              # Entry point, middleware, WebSocket setup
├── agents/               # AI agent system
│   ├── types.ts         # Agent type definitions
│   ├── index.ts         # Agent registry
│   └── specialists/     # Individual agent implementations
├── langchain/           # LangChain integration
│   ├── agents/          # LangChain agent configs
│   ├── tools/           # Tool definitions
│   └── vectorstore/     # Knowledge base
├── routes/              # API endpoints
│   ├── agents.ts        # /api/agents/*
│   ├── customers.ts     # /api/customers/*
│   ├── approvals.ts     # /api/approvals/*
│   ├── google/          # /api/google/* (OAuth, Gmail, etc.)
│   └── ...
├── services/            # Business logic
│   ├── gemini.ts        # Gemini API wrapper
│   ├── claude.ts        # Claude API wrapper
│   ├── session.ts       # Session management
│   ├── approval.ts      # HITL approval logic
│   ├── agentTracer.ts   # Observability
│   ├── circuitBreaker.ts
│   └── google/          # Workspace services
└── middleware/
    ├── errorHandler.ts  # Global error handling
    ├── auth.ts          # Authentication
    ├── metrics.ts       # Request metrics
    └── agenticRateLimit.ts
```

## API Route Patterns

### Standard Route Handler
```typescript
// routes/customers.ts
import { Router } from 'express';
import { customerService } from '../services/customer';

const router = Router();

// GET /api/customers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await customerService.getById(req.params.id);
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error); // Goes to errorHandler middleware
  }
});

// POST /api/customers
router.post('/', async (req, res, next) => {
  try {
    const { name, arr, tier } = req.body;

    // Validate input
    if (!name || !arr) {
      return res.status(400).json({
        success: false,
        error: 'Name and ARR are required'
      });
    }

    const customer = await customerService.create({ name, arr, tier });
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### WebSocket Events
```typescript
// In index.ts
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('agent:message', async (data) => {
    const { sessionId, message, customerId } = data;

    // Stream response tokens
    await streamAgentResponse(socket, sessionId, message, customerId);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Emitting events
socket.emit('message:token', { token: 'Hello' });
socket.emit('tool:call', { name: 'draft_email', params: {...} });
socket.emit('approval:created', { id: '...', action: 'send_email' });
```

## Service Layer Pattern

```typescript
// services/customer.ts
import { supabase } from '../lib/supabase';

export interface CustomerService {
  getById(id: string): Promise<Customer>;
  getAll(): Promise<Customer[]>;
  create(data: CreateCustomerDTO): Promise<Customer>;
  update(id: string, data: UpdateCustomerDTO): Promise<Customer>;
  updateHealthScore(id: string): Promise<void>;
}

export const customerService: CustomerService = {
  async getById(id) {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        stakeholders (*),
        health_scores (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw new ServiceError('CUSTOMER_NOT_FOUND', error.message);
    return data;
  },

  // ... other methods
};
```

## Error Handling

```typescript
// Custom error class
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Error codes
const ERROR_CODES = {
  CUSTOMER_NOT_FOUND: 404,
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  EXTERNAL_SERVICE_ERROR: 502,
};

// In middleware/errorHandler.ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);

  if (err instanceof ServiceError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
}
```

## Circuit Breaker Pattern

```typescript
// services/circuitBreaker.ts
class CircuitBreaker {
  private failures = 0;
  private lastFailure: Date | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure!.getTime() > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = new Date();
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

// Usage: Gemini with Claude fallback
const geminiCircuit = new CircuitBreaker(5, 30000);

export async function callLLM(prompt: string) {
  try {
    return await geminiCircuit.execute(() => gemini.generate(prompt));
  } catch {
    console.log('Gemini failed, falling back to Claude');
    return await claude.generate(prompt);
  }
}
```

## Common Gotchas

### 1. Async/Await in Routes
```typescript
// ❌ BAD - unhandled promise rejection
router.get('/', (req, res) => {
  const data = await fetchData(); // Error: await outside async
  res.json(data);
});

// ✅ GOOD - async handler with try/catch
router.get('/', async (req, res, next) => {
  try {
    const data = await fetchData();
    res.json(data);
  } catch (error) {
    next(error);
  }
});
```

### 2. Response After Send
```typescript
// ❌ BAD - headers already sent
router.get('/', async (req, res) => {
  res.json({ data: 'first' });
  res.json({ data: 'second' }); // Error!
});

// ✅ GOOD - return after response
router.get('/', async (req, res) => {
  if (condition) {
    return res.json({ data: 'first' });
  }
  return res.json({ data: 'second' });
});
```

### 3. Supabase Error Handling
```typescript
// ❌ BAD - ignoring error
const { data } = await supabase.from('customers').select();

// ✅ GOOD - check for errors
const { data, error } = await supabase.from('customers').select();
if (error) throw new ServiceError('DB_ERROR', error.message);
```

### 4. Environment Variables
```typescript
// ❌ BAD - no validation
const apiKey = process.env.API_KEY;

// ✅ GOOD - validate at startup
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY environment variable is required');
}
```

## Testing

```bash
# Run backend in dev mode
cd server && npm run dev

# Test API endpoint
curl http://localhost:3001/api/customers

# Check health
curl http://localhost:3001/health
```

## Environment Variables

```bash
# Required
PORT=3001
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GEMINI_API_KEY=AI...

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/oauth/callback

# Optional
LANGSMITH_API_KEY=ls-...
NODE_ENV=development
```
