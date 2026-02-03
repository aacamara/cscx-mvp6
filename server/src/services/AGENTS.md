# Services Layer - Agent Instructions

## Overview

Business logic layer containing all core functionality. Routes call services, services call database/external APIs.

## Service Categories

### AI Services
| Service | File | Purpose |
|---------|------|---------|
| Gemini | `gemini.ts` | Primary LLM (fast, cost-effective) |
| Claude | `claude.ts` | Fallback LLM (higher capability) |
| Circuit Breaker | `circuitBreaker.ts` | Auto-failover between providers |

### Platform Services
| Service | File | Purpose |
|---------|------|---------|
| Session | `session.ts` | Chat session management |
| Approval | `approval.ts` | HITL approval workflow |
| Agent Tracer | `agentTracer.ts` | Observability and logging |

### Google Services (in `google/` subdirectory)
| Service | File | Purpose |
|---------|------|---------|
| OAuth | `oauth.ts` | Token management |
| Gmail | `gmail.ts` | Email operations |
| Calendar | `calendar.ts` | Event management |
| Drive | `drive.ts` | File operations |
| Docs | `docs.ts` | Document templates |
| Sheets | `sheets.ts` | Spreadsheet templates |
| Slides | `slides.ts` | Presentation templates |
| Scripts | `scripts.ts` | Apps Script automation |
| Workspace | `workspace.ts` | Per-customer isolation |

## Service Pattern

```typescript
// services/customer.ts
import { supabase } from '../lib/supabase';
import { ServiceError } from '../errors';

export interface Customer {
  id: string;
  name: string;
  arr: number;
  tier: 'enterprise' | 'mid-market' | 'smb';
  health_score: number;
  renewal_date: string;
  csm_id: string;
}

export const customerService = {
  /**
   * Get customer by ID with related data
   */
  async getById(id: string): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        stakeholders (*),
        health_scores (
          overall,
          product,
          risk,
          outcomes,
          voice,
          engagement,
          calculated_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new ServiceError('CUSTOMER_NOT_FOUND', `Customer ${id} not found`);
    }

    return data;
  },

  /**
   * Calculate and update health score
   */
  async updateHealthScore(id: string): Promise<void> {
    const customer = await this.getById(id);

    // PROVE Framework calculation
    const product = await this.calculateProductScore(id);
    const risk = await this.calculateRiskScore(id);
    const outcomes = await this.calculateOutcomesScore(id);
    const voice = await this.calculateVoiceScore(id);
    const engagement = await this.calculateEngagementScore(id);

    const overall = Math.round(
      (product + risk + outcomes + voice + engagement) / 5
    );

    await supabase.from('health_scores').insert({
      customer_id: id,
      overall,
      product,
      risk,
      outcomes,
      voice,
      engagement,
      calculated_at: new Date().toISOString()
    });

    await supabase
      .from('customers')
      .update({ health_score: overall })
      .eq('id', id);
  }
};
```

## Error Handling Pattern

```typescript
// errors/ServiceError.ts
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Common error codes
export const ErrorCodes = {
  // 400 Bad Request
  INVALID_INPUT: { code: 'INVALID_INPUT', status: 400 },
  MISSING_REQUIRED_FIELD: { code: 'MISSING_REQUIRED_FIELD', status: 400 },

  // 401 Unauthorized
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401 },
  TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', status: 401 },

  // 404 Not Found
  CUSTOMER_NOT_FOUND: { code: 'CUSTOMER_NOT_FOUND', status: 404 },
  SESSION_NOT_FOUND: { code: 'SESSION_NOT_FOUND', status: 404 },

  // 429 Rate Limited
  RATE_LIMITED: { code: 'RATE_LIMITED', status: 429 },

  // 500 Internal
  DATABASE_ERROR: { code: 'DATABASE_ERROR', status: 500 },
  EXTERNAL_SERVICE_ERROR: { code: 'EXTERNAL_SERVICE_ERROR', status: 502 }
};
```

## Session Service

```typescript
// services/session.ts
interface Session {
  id: string;
  customer_id: string;
  agent_id: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

// Hybrid storage: Memory cache + Database
const sessionCache = new Map<string, Session>();

export const sessionService = {
  async get(id: string): Promise<Session | null> {
    // Check cache first
    if (sessionCache.has(id)) {
      return sessionCache.get(id)!;
    }

    // Fallback to database
    const { data } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      sessionCache.set(id, data);
    }

    return data;
  },

  async addMessage(sessionId: string, message: Message): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) throw new ServiceError('SESSION_NOT_FOUND', 'Session not found');

    session.messages.push(message);
    session.updated_at = new Date().toISOString();

    // Update cache
    sessionCache.set(sessionId, session);

    // Persist to database
    await supabase
      .from('agent_sessions')
      .update({
        messages: session.messages,
        updated_at: session.updated_at
      })
      .eq('id', sessionId);
  }
};
```

## Approval Service

```typescript
// services/approval.ts
export const approvalService = {
  async create(data: CreateApprovalDTO): Promise<Approval> {
    const approval = {
      id: crypto.randomUUID(),
      session_id: data.sessionId,
      action_type: data.actionType,
      action_description: data.description,
      action_data: data.data,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    await supabase.from('approvals').insert(approval);

    // Emit WebSocket event
    io.to(`session:${data.sessionId}`).emit('approval:created', approval);

    return approval;
  },

  async approve(id: string, userId: string, notes?: string): Promise<void> {
    const { data: approval } = await supabase
      .from('approvals')
      .select('*')
      .eq('id', id)
      .single();

    if (!approval) throw new ServiceError('APPROVAL_NOT_FOUND', 'Approval not found');
    if (approval.status !== 'pending') {
      throw new ServiceError('INVALID_STATUS', 'Approval already processed');
    }

    // Update status
    await supabase
      .from('approvals')
      .update({
        status: 'approved',
        decided_by: userId,
        decided_at: new Date().toISOString(),
        notes
      })
      .eq('id', id);

    // Execute the approved action
    await this.executeApprovedAction(approval);
  },

  async reject(id: string, userId: string, reason: string): Promise<void> {
    await supabase
      .from('approvals')
      .update({
        status: 'rejected',
        decided_by: userId,
        decided_at: new Date().toISOString(),
        notes: reason
      })
      .eq('id', id);
  }
};
```

## Common Gotchas

### 1. Don't Call Services from Services
```typescript
// ❌ BAD - circular dependencies
// customerService.ts
import { healthService } from './health';
async function updateCustomer() {
  await healthService.calculate(); // Creates dependency
}

// ✅ GOOD - compose at route level
// routes/customers.ts
import { customerService } from '../services/customer';
import { healthService } from '../services/health';

router.put('/:id', async (req, res) => {
  await customerService.update(req.params.id, req.body);
  await healthService.calculate(req.params.id);
  res.json({ success: true });
});
```

### 2. Always Handle Supabase Errors
```typescript
// ❌ BAD
const { data } = await supabase.from('customers').select();
return data;

// ✅ GOOD
const { data, error } = await supabase.from('customers').select();
if (error) {
  throw new ServiceError('DATABASE_ERROR', error.message);
}
return data ?? [];
```

### 3. Transaction Safety
```typescript
// ❌ BAD - partial failure possible
await supabase.from('customers').update({ arr: newARR }).eq('id', id);
await supabase.from('contracts').insert({ customer_id: id, arr: newARR });

// ✅ GOOD - use RPC for transactions
const { error } = await supabase.rpc('update_customer_arr', {
  p_customer_id: id,
  p_new_arr: newARR
});
```

### 4. Cache Invalidation
```typescript
// When data changes, invalidate cache
async function updateCustomer(id: string, data: UpdateDTO) {
  await supabase.from('customers').update(data).eq('id', id);

  // Invalidate relevant caches
  customerCache.delete(id);
  healthScoreCache.delete(id);
}
```
