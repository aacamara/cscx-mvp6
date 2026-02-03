# CSCX.AI Integrations Map

> Comprehensive mapping of all integrated services, their connection types, and data flows

---

## 1. Google Workspace

### 1.1 Overview
| Property | Value |
|----------|-------|
| **Provider** | Google |
| **Integration Type** | OAuth 2.0 |
| **Authentication** | User-based OAuth tokens |
| **Token Storage** | Supabase `google_tokens` table |

### 1.2 OAuth Scopes
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/presentations
https://www.googleapis.com/auth/script.projects
```

### 1.3 Service Capabilities

#### Gmail
| Capability | Data Flow | Endpoint |
|------------|-----------|----------|
| List threads | IN | `gmail.users.threads.list` |
| Get thread | IN | `gmail.users.threads.get` |
| Send email | OUT | `gmail.users.messages.send` |
| Create draft | OUT | `gmail.users.drafts.create` |
| Search emails | IN | `gmail.users.threads.list` (with query) |
| Mark as read | OUT | `gmail.users.threads.modify` |
| Archive thread | OUT | `gmail.users.threads.modify` |
| Star thread | OUT | `gmail.users.threads.modify` |
| Get labels | IN | `gmail.users.labels.list` |

#### Calendar
| Capability | Data Flow | Endpoint |
|------------|-----------|----------|
| List events | IN | `calendar.events.list` |
| Get event | IN | `calendar.events.get` |
| Create event | OUT | `calendar.events.insert` |
| Update event | OUT | `calendar.events.update` |
| Delete event | OUT | `calendar.events.delete` |
| Check availability | IN | `calendar.freebusy.query` |

#### Drive
| Capability | Data Flow | Endpoint |
|------------|-----------|----------|
| List files | IN | `drive.files.list` |
| Get file | IN | `drive.files.get` |
| Create folder | OUT | `drive.files.create` |
| Upload file | OUT | `drive.files.create` |
| Share file | OUT | `drive.permissions.create` |
| Delete file | OUT | `drive.files.delete` |
| Copy file | OUT | `drive.files.copy` |
| Move file | OUT | `drive.files.update` |

#### Docs
| Capability | Data Flow | Endpoint |
|------------|-----------|----------|
| Create document | OUT | `docs.documents.create` |
| Get document | IN | `docs.documents.get` |
| Update content | OUT | `docs.documents.batchUpdate` |

#### Sheets
| Capability | Data Flow | Endpoint |
|------------|-----------|----------|
| Create spreadsheet | OUT | `sheets.spreadsheets.create` |
| Get spreadsheet | IN | `sheets.spreadsheets.get` |
| Update values | OUT | `sheets.spreadsheets.values.update` |
| Append rows | OUT | `sheets.spreadsheets.values.append` |

#### Slides
| Capability | Data Flow | Endpoint |
|------------|-----------|----------|
| Create presentation | OUT | `slides.presentations.create` |
| Get presentation | IN | `slides.presentations.get` |
| Add slide | OUT | `slides.presentations.batchUpdate` |

### 1.4 Data Stored
- User tokens (access_token, refresh_token, expires_at)
- Connection status per user
- Customer workspace folder mappings
- Email thread references (for tracking)

---

## 2. Salesforce

### 2.1 Overview
| Property | Value |
|----------|-------|
| **Provider** | Salesforce |
| **Integration Type** | OAuth 2.0 |
| **Authentication** | User-based OAuth tokens |
| **Token Storage** | Supabase `integrations` table |
| **Status** | Implemented |

### 2.2 OAuth Flow
- Redirect to Salesforce login
- Exchange code for tokens
- Store connection with instance URL

### 2.3 Capabilities

| Capability | Data Flow | API |
|------------|-----------|-----|
| Get accounts | IN | REST API `/services/data/vXX.X/query` |
| Get contacts | IN | REST API `/services/data/vXX.X/query` |
| Push health scores | OUT | REST API `/services/data/vXX.X/sobjects/Account` |
| Sync customer data | BI-DIRECTIONAL | REST API |

### 2.4 Data Mapped
| CSCX Field | Salesforce Field |
|------------|------------------|
| `customer.name` | `Account.Name` |
| `customer.arr` | `Account.AnnualRevenue` |
| `customer.industry` | `Account.Industry` |
| `customer.health_score` | Custom field (configurable) |
| `stakeholder.email` | `Contact.Email` |

### 2.5 Sync Types
- **Account Sync**: Pull accounts from Salesforce to CSCX customers
- **Health Score Push**: Write CSCX health scores back to Salesforce

---

## 3. Slack

### 3.1 Overview
| Property | Value |
|----------|-------|
| **Provider** | Slack |
| **Integration Type** | OAuth 2.0 / Bot Token |
| **Authentication** | Workspace-level bot token |
| **Token Storage** | Supabase `slack_connections` table |

### 3.2 OAuth Scopes
```
channels:read
channels:history
chat:write
groups:read
im:read
im:write
mpim:read
reactions:write
users:read
users:read.email
```

### 3.3 Capabilities

| Capability | Data Flow | API Method |
|------------|-----------|------------|
| List channels | IN | `conversations.list` |
| Get channel info | IN | `conversations.info` |
| Send message | OUT | `chat.postMessage` |
| Reply to thread | OUT | `chat.postMessage` |
| Send DM | OUT | `chat.postMessage` |
| Add reaction | OUT | `reactions.add` |
| Get user | IN | `users.info` |
| Find user by email | IN | `users.lookupByEmail` |
| List users | IN | `users.list` |

### 3.4 Data Stored
- Bot token
- Team ID
- Connection status
- Channel cache (optional)

### 3.5 Approval Requirements
- Send message: **Requires approval**
- Send DM: **Requires approval**
- Reply to thread: **Requires approval**
- All read operations: Auto-approved

---

## 4. Zoom

### 4.1 Overview
| Property | Value |
|----------|-------|
| **Provider** | Zoom |
| **Integration Type** | OAuth 2.0 / Server-to-Server |
| **Authentication** | Account-level or user-level |
| **Token Storage** | Supabase `zoom_connections` table |

### 4.2 Capabilities

| Capability | Data Flow | API |
|------------|-----------|-----|
| List meetings | IN | `GET /users/{userId}/meetings` |
| Get meeting | IN | `GET /meetings/{meetingId}` |
| Create meeting | OUT | `POST /users/{userId}/meetings` |
| Get recording | IN | `GET /meetings/{meetingId}/recordings` |
| Get transcript | IN | `GET /meetings/{meetingId}/recordings` (VTT) |

### 4.3 Data Extracted
- Meeting metadata (title, start, duration, participants)
- Recording URLs
- Transcript text (VTT format)

### 4.4 Integration with Meeting Intelligence
- Transcripts fed to AI analysis
- Action items extracted
- Risk/expansion signals detected

---

## 5. Otter.ai

### 5.1 Overview
| Property | Value |
|----------|-------|
| **Provider** | Otter.ai |
| **Integration Type** | Webhook + API |
| **Authentication** | API key |

### 5.2 Data Flow
- **IN**: Webhook receives transcript completion notifications
- **IN**: API fetches full transcript content

### 5.3 Capabilities
| Capability | Data Flow |
|------------|-----------|
| Receive transcript webhook | IN |
| Fetch transcript | IN |
| Parse speakers | IN |
| Get summary | IN |

### 5.4 Data Extracted
- Full transcript text
- Speaker identification
- Timestamps
- AI-generated summary (from Otter)

---

## 6. Usage Data Ingestion (Custom)

### 6.1 Overview
| Property | Value |
|----------|-------|
| **Provider** | Custom / Client Systems |
| **Integration Type** | REST API |
| **Authentication** | API key header |
| **Endpoint** | `POST /api/v1/usage` |

### 6.2 Data Schema
```json
{
  "customerId": "uuid",
  "events": [
    {
      "type": "login|feature_usage|api_call|session",
      "timestamp": "ISO8601",
      "userId": "string",
      "metadata": {}
    }
  ]
}
```

### 6.3 Metrics Calculated
| Metric | Aggregation |
|--------|-------------|
| DAU | Daily unique users |
| WAU | Weekly unique users |
| MAU | Monthly unique users |
| Login count | Total logins |
| API calls | Total API requests |
| Session duration | Average session length |
| Feature adoption | Feature usage matrix |
| Usage trend | Growing/stable/declining |
| Adoption score | Composite score 0-100 |

### 6.4 Data Storage
- `usage_events` table (raw events)
- `usage_metrics` table (aggregated metrics)

---

## 7. Internal Services

### 7.1 Supabase
| Property | Value |
|----------|-------|
| **Type** | Database + Auth |
| **Connection** | Service key |
| **Usage** | Primary data store, RLS for security |

### 7.2 AI Services

#### Claude (Anthropic)
| Property | Value |
|----------|-------|
| **Type** | LLM API |
| **Authentication** | API key |
| **Usage** | Chat, analysis, orchestration |
| **Models** | claude-opus-4, claude-sonnet-4, claude-haiku-4 |

#### Gemini (Google)
| Property | Value |
|----------|-------|
| **Type** | LLM API |
| **Authentication** | API key |
| **Usage** | Alternative AI provider |

#### OpenAI Embeddings
| Property | Value |
|----------|-------|
| **Type** | Embeddings API |
| **Authentication** | API key |
| **Usage** | Semantic search, knowledge base |

---

## 8. MCP Tool Registry

### 8.1 Providers Registered
| Provider | Tools Count | Status |
|----------|-------------|--------|
| Google | 26+ | Active |
| Slack | 10 | Active |
| Zoom | 5 | Active |
| Internal | 10+ | Active |

### 8.2 Circuit Breaker Status
- Per-provider circuit breakers
- Failure threshold: 5
- Success threshold for recovery: 3
- Timeout: 30 seconds

---

## 9. Webhooks (Inbound)

| Webhook | Source | Endpoint |
|---------|--------|----------|
| Otter transcript | Otter.ai | `/api/otter/webhook` |
| Slack events | Slack | `/api/slack/events` |
| Zoom events | Zoom | `/api/zoom/webhook` |
| Google callback | Google | `/api/google/callback` |
| Salesforce callback | Salesforce | `/api/integrations/salesforce/callback` |

---

## 10. Webhooks (Outbound)

| Trigger | Destination | Format |
|---------|-------------|--------|
| Custom automation | Configurable URL | JSON POST |
| Trigger action | Configurable URL | JSON POST |

---

## 11. Data Flow Summary

```
                    ┌─────────────────┐
                    │   CSCX.AI       │
                    │   Platform      │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Google       │   │  Slack        │   │  Zoom         │
│  Workspace    │   │               │   │               │
│  BI-DIRECT    │   │  BI-DIRECT    │   │  IN           │
└───────────────┘   └───────────────┘   └───────────────┘
        │                    │                    │
        │           ┌────────┴────────┐          │
        │           │                 │          │
        ▼           ▼                 ▼          ▼
┌───────────────┐   ┌─────────┐   ┌─────────┐
│  Salesforce   │   │ Otter   │   │  Usage  │
│  BI-DIRECT    │   │  IN     │   │  API IN │
└───────────────┘   └─────────┘   └─────────┘
```

**Legend:**
- **IN**: Data flows into CSCX
- **OUT**: Data flows out from CSCX
- **BI-DIRECT**: Bidirectional data flow
