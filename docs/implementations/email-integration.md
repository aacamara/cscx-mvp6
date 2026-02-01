# Email Integration (PRD: Email Integration)

## Overview

Full Gmail integration allowing CSMs to sync, search, and get AI-powered summaries of customer emails directly within CSCX.

## Features Implemented

### 1. Email Sync Service (`server/src/services/email/emailService.ts`)
- Fetches emails from Gmail API via OAuth2
- Stores in `emails` table with full metadata
- Supports incremental sync with configurable date range
- Tracks sync status per user in `email_sync_status` table

### 2. Customer Email Matching (`emailService.ts:525-768`)
Three matching strategies with confidence scoring:
- **Stakeholder match** (100%): Match by known stakeholder email address
- **Domain match** (90%): Match by company domain (excludes common providers)
- **Name mention match** (50-70%): Match by customer name in subject/body

### 3. Email Summarization (`server/src/routes/email.ts`)
- Claude-powered email summarization
- Extracts key points, action items, and sentiment
- Identifies mentioned customers
- Supports both single email and batch summarization

### 4. Email Priority Widget (`components/EmailPriorityWidget.tsx`)
- Dashboard widget showing priority emails at a glance
- Color-coded priority badges (Urgent, High, Important, Normal)
- Quick actions: Summarize, View
- Compact and full view modes
- Auto-refresh with configurable interval

### 5. Natural Language Email Queries
Intent classifier (`server/src/services/nlQuery/intentClassifier.ts`) supports:
- `email_query`: Search/list emails ("emails from X", "unread emails")
- `email_summary`: Summarize emails ("summarize emails about Y")

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/email/sync` | POST | Trigger email sync for user |
| `/api/email/status` | GET | Get sync status |
| `/api/email/list` | GET | Get emails with filters |
| `/api/email/summarize` | POST | AI-summarize emails |
| `/api/email/link-customers` | POST | Link unmatched emails |

## Database Schema

### emails table
```sql
CREATE TABLE emails (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  gmail_id text NOT NULL,
  thread_id text NOT NULL,
  subject text,
  from_email text NOT NULL,
  from_name text,
  to_emails text[],
  cc_emails text[],
  bcc_emails text[],
  date timestamptz NOT NULL,
  body_text text,
  body_html text,
  snippet text,
  labels text[],
  is_read boolean,
  is_important boolean,
  is_starred boolean,
  has_attachments boolean,
  customer_id uuid REFERENCES customers(id),
  matched_by text,
  match_confidence float,
  summary text,
  key_points jsonb,
  action_items jsonb,
  synced_at timestamptz,
  created_at timestamptz,
  UNIQUE(user_id, gmail_id)
);
```

### email_sync_status table
```sql
CREATE TABLE email_sync_status (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  connected boolean,
  last_sync_at timestamptz,
  last_sync_success boolean,
  last_sync_error text,
  emails_synced integer,
  updated_at timestamptz,
  created_at timestamptz
);
```

## Migration

Apply the migration:
```bash
cd server
# Option 1: Supabase CLI
npx supabase migration up

# Option 2: Direct SQL (via Supabase dashboard)
# Copy contents of supabase/migrations/20260201_emails_table.sql
```

## Usage Examples

### Sync emails
```bash
curl -X POST http://localhost:3001/api/email/sync \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -d '{"days": 30}'
```

### List emails
```bash
curl "http://localhost:3001/api/email/list?limit=10&unreadOnly=true" \
  -H "x-user-id: YOUR_USER_ID"
```

### Summarize emails
```bash
curl -X POST http://localhost:3001/api/email/summarize \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -d '{"query": "TechCorp renewal"}'
```

## Frontend Usage

```tsx
import { EmailPriorityWidget } from '@/components/EmailPriorityWidget';

// Compact mode for sidebars
<EmailPriorityWidget compact limit={3} />

// Full mode for dashboard
<EmailPriorityWidget
  limit={10}
  refreshInterval={60000}
  onEmailClick={(id) => handleViewEmail(id)}
/>
```

## Files

| File | Purpose |
|------|---------|
| `server/src/services/email/emailService.ts` | Core sync & matching logic |
| `server/src/services/email/threadParser.ts` | Email thread parsing |
| `server/src/routes/email.ts` | API routes |
| `components/EmailPriorityWidget.tsx` | Dashboard widget |
| `server/src/services/nlQuery/intentClassifier.ts` | NL query classification |
| `server/supabase/migrations/20260201_emails_table.sql` | Database schema |

## Status

- ✅ Email sync service
- ✅ Customer matching
- ✅ AI summarization
- ✅ Priority widget
- ✅ NL query support
- ⚠️ Migration needs to be applied
