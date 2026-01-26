# CSCX.AI API Reference

Complete API documentation for the CSCX.AI backend.

## Base URL

- Development: `http://localhost:3001`
- Production: `https://api.cscx.ai`

## Authentication

All endpoints (except `/health`) require authentication via Bearer token:

```
Authorization: Bearer <supabase_access_token>
```

---

## Endpoints

### Health Check

#### GET /health

Check API status.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-01-04T12:00:00Z"
}
```

---

## Agents API

### POST /api/agents/chat

Send a message to the agent system.

**Request:**
```json
{
  "sessionId": "session_123",
  "message": "Start onboarding for Acme Corp",
  "customerId": "cust_456"
}
```

**Response:**
```json
{
  "id": "msg_789",
  "sessionId": "session_123",
  "agentId": "onboarding",
  "message": "I'll help you onboard Acme Corp. Let me first gather their information.",
  "metadata": {
    "thinking": false,
    "requiresApproval": false,
    "deployedAgent": null
  },
  "timestamp": "2025-01-04T12:00:00Z"
}
```

### GET /api/agents/sessions/:sessionId

Get all messages in a session.

**Response:**
```json
{
  "sessionId": "session_123",
  "customerId": "cust_456",
  "messages": [
    {
      "id": "msg_001",
      "agentId": "onboarding",
      "role": "agent",
      "content": "Hello! How can I help?",
      "timestamp": "2025-01-04T12:00:00Z"
    }
  ],
  "status": "active"
}
```

### POST /api/agents/approve/:approvalId

Approve or reject a pending action.

**Request:**
```json
{
  "approved": true,
  "comment": "Looks good, proceed"
}
```

**Response:**
```json
{
  "id": "approval_123",
  "status": "approved",
  "resolvedAt": "2025-01-04T12:00:00Z"
}
```

### GET /api/agents/pending

Get all pending approvals.

**Response:**
```json
{
  "approvals": [
    {
      "id": "approval_123",
      "sessionId": "session_123",
      "agentId": "meeting",
      "action": "scheduleMeeting",
      "details": "Schedule discovery call with Acme Corp for Jan 20",
      "status": "pending",
      "createdAt": "2025-01-04T12:00:00Z"
    }
  ]
}
```

---

## Contracts API

### POST /api/contracts/parse

Parse a contract document.

**Request (multipart/form-data):**
```
file: <PDF file>
```

Or **Request (JSON):**
```json
{
  "type": "text",
  "content": "Contract text content..."
}
```

**Response:**
```json
{
  "id": "contract_123",
  "company_name": "Acme Corporation",
  "arr": 150000,
  "contract_term": "36 months",
  "entitlements": [
    {
      "name": "Enterprise License",
      "quantity": 100,
      "description": "Full platform access"
    }
  ],
  "stakeholders": [
    {
      "name": "John Smith",
      "role": "CTO",
      "email": "john@acme.com"
    }
  ],
  "technical_requirements": [
    {
      "category": "Security",
      "requirement": "SSO via Okta",
      "priority": "high"
    }
  ],
  "pricing_terms": {
    "base_price": 150000,
    "billing_frequency": "annual",
    "payment_terms": "Net 30"
  }
}
```

### GET /api/contracts/:id

Get a parsed contract by ID.

### GET /api/contracts

List all contracts.

**Query Parameters:**
- `customerId` - Filter by customer
- `status` - Filter by status (active, expired, pending)
- `limit` - Number of results (default: 20)
- `offset` - Pagination offset

---

## Customers API

### POST /api/customers

Create a new customer.

**Request:**
```json
{
  "name": "Acme Corporation",
  "arr": 150000,
  "industry": "Technology",
  "stakeholders": [
    {
      "name": "John Smith",
      "role": "CTO",
      "email": "john@acme.com"
    }
  ]
}
```

**Response:**
```json
{
  "id": "cust_123",
  "name": "Acme Corporation",
  "arr": 150000,
  "healthScore": null,
  "stage": "onboarding",
  "createdAt": "2025-01-04T12:00:00Z"
}
```

### GET /api/customers/:id

Get customer details.

**Response:**
```json
{
  "id": "cust_123",
  "name": "Acme Corporation",
  "arr": 150000,
  "healthScore": 87,
  "stage": "active",
  "stakeholders": [...],
  "contracts": [...],
  "insights": {...},
  "timeline": [...]
}
```

### PATCH /api/customers/:id

Update customer details.

### GET /api/customers/:id/health

Get detailed health score breakdown.

**Response:**
```json
{
  "overall": 87,
  "components": {
    "engagement": 92,
    "adoption": 78,
    "sentiment": 85,
    "growth": 93
  },
  "trends": {
    "weekly": "+3",
    "monthly": "+12"
  },
  "risks": [
    {
      "category": "adoption",
      "description": "Low usage in analytics module",
      "severity": "medium"
    }
  ]
}
```

### GET /api/customers/:id/timeline

Get customer timeline/activity history.

---

## Meetings API

### POST /api/meetings/schedule

Schedule a new meeting.

**Request:**
```json
{
  "customerId": "cust_123",
  "attendees": ["john@acme.com", "jane@company.com"],
  "duration": 60,
  "agenda": "Discovery call",
  "preferredTimes": ["2025-01-20T10:00:00Z", "2025-01-20T14:00:00Z"]
}
```

**Response:**
```json
{
  "id": "meeting_123",
  "status": "pending_approval",
  "suggestedTime": "2025-01-20T10:00:00Z",
  "calendarLink": null
}
```

### GET /api/meetings/:id

Get meeting details.

### POST /api/meetings/:id/transcript

Upload or create transcript for a meeting.

**Request:**
```json
{
  "content": "Full transcript text...",
  "duration": 2700
}
```

### GET /api/meetings/:id/insights

Get AI-extracted insights from meeting.

**Response:**
```json
{
  "meetingId": "meeting_123",
  "summary": "Discovery call focused on...",
  "decisions": [
    "Proceed with Phase 1 implementation"
  ],
  "actionItems": [
    {
      "description": "Send SOW by Friday",
      "owner": "John Smith",
      "dueDate": "2025-01-24"
    }
  ],
  "concerns": [
    "Integration timeline concerns"
  ],
  "sentiment": "positive",
  "keyQuotes": [
    {
      "speaker": "John Smith",
      "quote": "This could transform our operations"
    }
  ]
}
```

---

## Insights API

### GET /api/insights/:customerId

Get all insights for a customer.

### POST /api/insights/generate

Generate new insights from available data.

**Request:**
```json
{
  "customerId": "cust_123",
  "types": ["health", "risk", "opportunity"]
}
```

---

## Training API

### GET /api/training/modules

List available training modules.

### POST /api/training/generate

Generate custom training content.

**Request:**
```json
{
  "customerId": "cust_123",
  "topic": "API Integration",
  "level": "intermediate"
}
```

### GET /api/training/:customerId/progress

Get training progress for a customer.

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('wss://api.cscx.ai/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_access_token'
  }));
};
```

### Events

**Agent Message:**
```json
{
  "type": "agent_message",
  "data": {
    "sessionId": "session_123",
    "agentId": "onboarding",
    "message": "Processing your request..."
  }
}
```

**Approval Required:**
```json
{
  "type": "approval_required",
  "data": {
    "id": "approval_123",
    "action": "scheduleMeeting",
    "details": "..."
  }
}
```

**Agent Deployed:**
```json
{
  "type": "agent_deployed",
  "data": {
    "agentId": "meeting",
    "sessionId": "session_123"
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid or missing auth token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /api/agents/chat | 60/minute |
| /api/contracts/parse | 10/minute |
| /api/* (general) | 1000/hour |

---

## SDKs

### JavaScript/TypeScript

```typescript
import { CSCXClient } from '@cscx/sdk';

const client = new CSCXClient({
  apiKey: 'your_api_key',
  baseUrl: 'https://api.cscx.ai'
});

// Send message to agent
const response = await client.agents.chat({
  sessionId: 'session_123',
  message: 'Start onboarding'
});

// Parse contract
const contract = await client.contracts.parse(file);
```
