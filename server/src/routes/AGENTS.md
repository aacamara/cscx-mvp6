# Routes - Agent Instructions

## Overview

Express.js API routes. Each route file handles a specific domain.

## Route Files

| File | Base Path | Purpose |
|------|-----------|---------|
| `agents.ts` | `/api/agents` | Agent chat, sessions, approvals |
| `customers.ts` | `/api/customers` | Customer CRUD |
| `approvals.ts` | `/api/approvals` | HITL approval actions |
| `google/oauth.ts` | `/api/google/oauth` | OAuth flow |
| `google/gmail.ts` | `/api/google/email` | Email operations |
| `google/calendar.ts` | `/api/google/calendar` | Calendar operations |
| `google/drive.ts` | `/api/google/drive` | Drive operations |
| `analytics.ts` | `/api/analytics` | Health, usage, metrics |
| `integrations.ts` | `/api/integrations` | Third-party connections |

## Route Pattern

```typescript
// routes/customers.ts
import { Router } from 'express';
import { customerService } from '../services/customer';

const router = Router();

// GET /api/customers
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, tier, healthMin } = req.query;

    const customers = await customerService.getAll({
      page: Number(page),
      limit: Number(limit),
      search: search as string,
      tier: tier as string,
      healthMin: healthMin ? Number(healthMin) : undefined
    });

    res.json({
      success: true,
      data: customers.data,
      pagination: customers.pagination
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await customerService.getById(req.params.id);
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

// POST /api/customers
router.post('/', async (req, res, next) => {
  try {
    const { name, arr, tier } = req.body;

    // Validation
    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
        code: 'MISSING_NAME'
      });
    }

    const customer = await customerService.create({
      name: name.trim(),
      arr: Number(arr) || 0,
      tier: tier || 'smb'
    });

    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

export default router;
```

## Agent Routes

```typescript
// routes/agents.ts

// POST /api/agents/chat - Send message to agent
router.post('/chat', async (req, res, next) => {
  try {
    const { sessionId, message, customerId } = req.body;

    // Create or get session
    let session = sessionId
      ? await sessionService.get(sessionId)
      : await sessionService.create({ customerId, userId: req.user.id });

    // Route to appropriate agent
    const routing = await routeMessage(message, session);

    // Execute agent
    const response = await executeAgent(
      routing.agent,
      message,
      session,
      { customerId }
    );

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        agent: routing.agent,
        message: response.message,
        toolCalls: response.toolCalls,
        pendingApprovals: response.pendingApprovals
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/agents/approve/:id - Approve pending action
router.post('/approve/:id', async (req, res, next) => {
  try {
    const { notes } = req.body;
    await approvalService.approve(req.params.id, req.user.id, notes);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/agents/reject/:id - Reject pending action
router.post('/reject/:id', async (req, res, next) => {
  try {
    const { reason } = req.body;
    await approvalService.reject(req.params.id, req.user.id, reason);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/sessions/:id - Get session with messages
router.get('/sessions/:id', async (req, res, next) => {
  try {
    const session = await sessionService.getWithMessages(req.params.id);
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// GET /api/agents/run/:id - Get agent run trace
router.get('/run/:id', async (req, res, next) => {
  try {
    const run = await agentTracerService.getRun(req.params.id);
    res.json({ success: true, data: run });
  } catch (error) {
    next(error);
  }
});
```

## Google Routes

```typescript
// routes/google/oauth.ts

// GET /api/google/oauth/login - Start OAuth flow
router.get('/login', (req, res) => {
  const { returnTo } = req.query;

  const authUrl = getGoogleAuthUrl([
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive'
  ], {
    userId: req.user.id,
    returnTo: returnTo as string
  });

  res.redirect(authUrl);
});

// GET /api/google/oauth/callback - OAuth callback
router.get('/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const { userId, returnTo } = JSON.parse(state as string);

    const tokens = await exchangeCodeForTokens(code as string);
    await saveTokens(userId, tokens);

    res.redirect(returnTo || '/');
  } catch (error) {
    next(error);
  }
});

// GET /api/google/oauth/status - Check if connected
router.get('/status', async (req, res, next) => {
  try {
    const tokens = await getStoredTokens(req.user.id);
    res.json({
      success: true,
      data: {
        connected: !!tokens,
        email: tokens?.email,
        expiresAt: tokens?.expiry_date
      }
    });
  } catch (error) {
    next(error);
  }
});
```

## Error Response Format

```typescript
// Consistent error format
interface ErrorResponse {
  success: false;
  error: string;        // Human-readable message
  code?: string;        // Machine-readable code
  details?: unknown;    // Additional context
}

// Example error responses
res.status(400).json({
  success: false,
  error: 'Invalid customer ID format',
  code: 'INVALID_ID'
});

res.status(404).json({
  success: false,
  error: 'Customer not found',
  code: 'CUSTOMER_NOT_FOUND'
});

res.status(500).json({
  success: false,
  error: 'Internal server error',
  code: 'INTERNAL_ERROR'
});
```

## Common Gotchas

### 1. Return after response
```typescript
// ❌ BAD - continues execution
router.get('/:id', async (req, res, next) => {
  if (!req.params.id) {
    res.status(400).json({ error: 'ID required' });
  }
  const data = await service.get(req.params.id); // Still runs!
  res.json(data); // Error: headers already sent
});

// ✅ GOOD - return stops execution
router.get('/:id', async (req, res, next) => {
  if (!req.params.id) {
    return res.status(400).json({ error: 'ID required' });
  }
  const data = await service.get(req.params.id);
  return res.json(data);
});
```

### 2. Always use next(error)
```typescript
// ❌ BAD - swallows error
router.get('/', async (req, res) => {
  try {
    const data = await service.getAll();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ✅ GOOD - passes to error handler
router.get('/', async (req, res, next) => {
  try {
    const data = await service.getAll();
    res.json(data);
  } catch (error) {
    next(error); // Error handler formats response
  }
});
```

### 3. Validate query params
```typescript
// ❌ BAD - no validation
const page = req.query.page; // Could be array, undefined, etc.

// ✅ GOOD - validate and parse
const page = Math.max(1, Number(req.query.page) || 1);
const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
```
