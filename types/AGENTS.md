# Types - Agent Instructions

## Overview

TypeScript type definitions shared between frontend and backend. Keep types DRY by defining once here.

## Key Type Files

| File | Purpose |
|------|---------|
| `agents.ts` | Agent system types (specialists, tools, context) |
| `agentBuilder.ts` | Agent Studio configuration types |
| `workflow.ts` | Onboarding workflow state machine |
| `customer.ts` | Customer and stakeholder types |
| `google.ts` | Google Workspace types |

## Agent Types

```typescript
// types/agents.ts

export type AgentId =
  | 'orchestrator'
  | 'onboarding'
  | 'adoption'
  | 'renewal'
  | 'risk'
  | 'strategic'
  | 'communicator'
  | 'scheduler'
  | 'researcher';

export interface AgentSpecialist {
  id: AgentId;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  tools: AgentTool[];
  triggerKeywords: string[];
  contextTriggers?: {
    healthThreshold?: number;
    daysToRenewal?: number;
    isNewCustomer?: boolean;
  };
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: JSONSchema;
  requiresApproval: boolean;
  approvalType?: 'auto' | 'always_require' | 'never_allow';
  execute: (params: unknown, context: AgentContext) => Promise<ToolResult>;
}

export interface AgentContext {
  userId: string;
  userName: string;
  customerId?: string;
  customerName?: string;
  customerARR?: number;
  healthScore?: number;
  daysToRenewal?: number;
  sessionId: string;
  previousAgent?: AgentId;
  conversationHistory: Message[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  message: string;
  requiresApproval?: boolean;
  approvalId?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  timestamp: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: ToolResult;
}
```

## Workflow Types

```typescript
// types/workflow.ts

export type OnboardingPhase =
  | 'upload'
  | 'parsing'
  | 'review'
  | 'enriching'
  | 'planning'
  | 'plan_review'
  | 'executing'
  | 'monitoring'
  | 'completed';

export interface WorkflowState {
  phase: OnboardingPhase;
  customerId?: string;
  contractData?: ContractData;
  stakeholders: Stakeholder[];
  entitlements: Entitlement[];
  successPlan?: SuccessPlan;
  errors: WorkflowError[];
  isLoading: boolean;
}

export type WorkflowAction =
  | { type: 'SET_PHASE'; phase: OnboardingPhase }
  | { type: 'SET_CONTRACT_DATA'; data: ContractData }
  | { type: 'ADD_STAKEHOLDER'; stakeholder: Stakeholder }
  | { type: 'REMOVE_STAKEHOLDER'; id: string }
  | { type: 'SET_SUCCESS_PLAN'; plan: SuccessPlan }
  | { type: 'SET_ERROR'; error: WorkflowError }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'RESET' };

export function workflowReducer(
  state: WorkflowState,
  action: WorkflowAction
): WorkflowState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };
    case 'SET_CONTRACT_DATA':
      return { ...state, contractData: action.data };
    // ... other cases
    default:
      return state;
  }
}
```

## Customer Types

```typescript
// types/customer.ts

export interface Customer {
  id: string;
  name: string;
  arr: number;
  tier: 'enterprise' | 'mid-market' | 'smb';
  health_score: number;
  renewal_date: string;
  csm_id: string;
  status: 'active' | 'churned' | 'onboarding';
  created_at: string;
  updated_at: string;

  // Relations (when joined)
  stakeholders?: Stakeholder[];
  health_scores?: HealthScore[];
  contracts?: Contract[];
}

export interface Stakeholder {
  id: string;
  customer_id: string;
  name: string;
  email: string;
  title?: string;
  role: 'champion' | 'sponsor' | 'user' | 'detractor';
  is_primary: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface HealthScore {
  id: string;
  customer_id: string;
  overall: number;
  product: number;
  risk: number;
  outcomes: number;
  voice: number;
  engagement: number;
  calculated_at: string;
}

export interface Contract {
  id: string;
  customer_id: string;
  file_url?: string;
  parsed_data?: ContractData;
  start_date: string;
  end_date: string;
}

export interface ContractData {
  company_name: string;
  arr: number;
  start_date: string;
  end_date: string;
  stakeholders: Array<{
    name: string;
    title: string;
    email?: string;
  }>;
  entitlements: Array<{
    product: string;
    quantity: number;
  }>;
}
```

## API Response Types

```typescript
// types/api.ts

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
}

// Usage in components
async function fetchCustomer(id: string): Promise<Customer> {
  const response = await fetch(`/api/customers/${id}`);
  const result: ApiResponse<Customer> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch customer');
  }

  return result.data;
}
```

## Best Practices

### 1. Use Discriminated Unions for Actions
```typescript
// ❌ BAD - any type
interface Action {
  type: string;
  payload?: any;
}

// ✅ GOOD - discriminated union
type Action =
  | { type: 'INCREMENT'; amount: number }
  | { type: 'DECREMENT'; amount: number }
  | { type: 'RESET' };
```

### 2. Make Properties Optional When Appropriate
```typescript
// ❌ BAD - everything required
interface CreateCustomerDTO {
  name: string;
  arr: number;
  tier: string;
  renewal_date: string;
  csm_id: string;
}

// ✅ GOOD - required vs optional
interface CreateCustomerDTO {
  name: string;
  arr: number;
  tier?: 'enterprise' | 'mid-market' | 'smb';  // Optional with default
  renewal_date?: string;                        // Optional
  csm_id?: string;                              // Optional
}
```

### 3. Use const assertions for literals
```typescript
// ❌ BAD - type is string[]
const TIERS = ['enterprise', 'mid-market', 'smb'];

// ✅ GOOD - type is readonly tuple
const TIERS = ['enterprise', 'mid-market', 'smb'] as const;
type Tier = typeof TIERS[number]; // 'enterprise' | 'mid-market' | 'smb'
```

### 4. Export types and interfaces
```typescript
// ❌ BAD - not exported
interface Customer { ... }

// ✅ GOOD - exported for use elsewhere
export interface Customer { ... }
```

## Type Guards

```typescript
// Useful type guards
export function isCustomer(obj: unknown): obj is Customer {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'arr' in obj
  );
}

export function isApiError(response: ApiResponse<unknown>): response is ApiResponse<never> & { error: string } {
  return !response.success && !!response.error;
}
```
