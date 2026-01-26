# CSCX.AI - Google Workspace Deep Integration

## Strategic Decision: All-In on Google

CSCX.AI will leverage the full Google ecosystem for maximum integration depth and seamless user experience.

### Why Google-First?

| Benefit | Description |
|---------|-------------|
| **Single OAuth** | One consent screen, access to 15+ products |
| **Unified APIs** | Consistent patterns across all services |
| **GCP Synergy** | Same platform for hosting + integrations |
| **Enterprise Ready** | Google Workspace dominates enterprise |
| **AI Native** | Gemini + Vertex AI integration |
| **Cost Effective** | Many APIs included in Workspace subscription |

---

## Google Products Integration Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     GOOGLE WORKSPACE INTEGRATION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  COMMUNICATION                           PRODUCTIVITY                        │
│  ─────────────                           ────────────                        │
│  ┌─────────────┐  ┌─────────────┐       ┌─────────────┐  ┌─────────────┐   │
│  │   Gmail     │  │Google Meet  │       │Google Drive │  │Google Docs  │   │
│  │             │  │             │       │             │  │             │   │
│  │ • Read      │  │ • Create    │       │ • Browse    │  │ • Create    │   │
│  │ • Draft     │  │ • Schedule  │       │ • Upload    │  │ • Edit      │   │
│  │ • Send      │  │ • Record    │       │ • Share     │  │ • Template  │   │
│  │ • Labels    │  │ • Transcript│       │ • Search    │  │ • Export    │   │
│  └─────────────┘  └─────────────┘       └─────────────┘  └─────────────┘   │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐       ┌─────────────┐  ┌─────────────┐   │
│  │Google Chat  │  │Google Voice │       │Google Sheets│  │Google Slides│   │
│  │             │  │             │       │             │  │             │   │
│  │ • Spaces    │  │ • Calls     │       │ • Create    │  │ • Create    │   │
│  │ • Messages  │  │ • Voicemail │       │ • Update    │  │ • QBR Decks │   │
│  │ • Notify    │  │ • SMS       │       │ • Formulas  │  │ • Templates │   │
│  └─────────────┘  └─────────────┘       └─────────────┘  └─────────────┘   │
│                                                                             │
│  ORGANIZATION                            AI & DATA                          │
│  ────────────                            ─────────                          │
│  ┌─────────────┐  ┌─────────────┐       ┌─────────────┐  ┌─────────────┐   │
│  │  Calendar   │  │Google Tasks │       │  Gemini AI  │  │  Vertex AI  │   │
│  │             │  │             │       │             │  │             │   │
│  │ • Events    │  │ • Create    │       │ • Chat      │  │ • Embeddings│   │
│  │ • Schedule  │  │ • Assign    │       │ • Vision    │  │ • Search    │   │
│  │ • Reminders │  │ • Track     │       │ • Code      │  │ • Predict   │   │
│  │ • Free/Busy │  │ • Complete  │       │ • Summarize │  │ • Train     │   │
│  └─────────────┘  └─────────────┘       └─────────────┘  └─────────────┘   │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐       ┌─────────────┐  ┌─────────────┐   │
│  │  Contacts   │  │Google Forms │       │  BigQuery   │  │  Looker     │   │
│  │             │  │             │       │             │  │             │   │
│  │ • Directory │  │ • Surveys   │       │ • Analytics │  │ • Dashboards│   │
│  │ • Org Chart │  │ • NPS       │       │ • Warehouse │  │ • Reports   │   │
│  │ • Details   │  │ • Feedback  │       │ • ML        │  │ • Embed     │   │
│  └─────────────┘  └─────────────┘       └─────────────┘  └─────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## OAuth Scopes - Comprehensive Access

```typescript
// All Google Workspace scopes for CSCX.AI
export const GOOGLE_SCOPES = [
  // ============ GMAIL ============
  'https://www.googleapis.com/auth/gmail.readonly',        // Read emails
  'https://www.googleapis.com/auth/gmail.compose',         // Create drafts
  'https://www.googleapis.com/auth/gmail.send',            // Send emails
  'https://www.googleapis.com/auth/gmail.labels',          // Manage labels
  'https://www.googleapis.com/auth/gmail.modify',          // Modify (archive, etc)

  // ============ CALENDAR ============
  'https://www.googleapis.com/auth/calendar',              // Full calendar access
  'https://www.googleapis.com/auth/calendar.events',       // Create/edit events
  'https://www.googleapis.com/auth/calendar.readonly',     // Read calendars

  // ============ GOOGLE MEET ============
  'https://www.googleapis.com/auth/meetings.space.created', // Create meetings
  'https://www.googleapis.com/auth/meetings.space.readonly', // Read meeting info

  // ============ DRIVE ============
  'https://www.googleapis.com/auth/drive',                 // Full Drive access
  'https://www.googleapis.com/auth/drive.file',            // Files created by app
  'https://www.googleapis.com/auth/drive.readonly',        // Read-only access

  // ============ DOCS ============
  'https://www.googleapis.com/auth/documents',             // Create/edit docs
  'https://www.googleapis.com/auth/documents.readonly',    // Read docs

  // ============ SHEETS ============
  'https://www.googleapis.com/auth/spreadsheets',          // Create/edit sheets
  'https://www.googleapis.com/auth/spreadsheets.readonly', // Read sheets

  // ============ SLIDES ============
  'https://www.googleapis.com/auth/presentations',         // Create/edit slides
  'https://www.googleapis.com/auth/presentations.readonly', // Read slides

  // ============ TASKS ============
  'https://www.googleapis.com/auth/tasks',                 // Full task access
  'https://www.googleapis.com/auth/tasks.readonly',        // Read tasks

  // ============ CONTACTS ============
  'https://www.googleapis.com/auth/contacts',              // Manage contacts
  'https://www.googleapis.com/auth/contacts.readonly',     // Read contacts
  'https://www.googleapis.com/auth/directory.readonly',    // Read org directory

  // ============ CHAT ============
  'https://www.googleapis.com/auth/chat.spaces',           // Manage spaces
  'https://www.googleapis.com/auth/chat.messages',         // Send messages
  'https://www.googleapis.com/auth/chat.messages.readonly', // Read messages

  // ============ FORMS ============
  'https://www.googleapis.com/auth/forms.body',            // Create/edit forms
  'https://www.googleapis.com/auth/forms.responses.readonly', // Read responses

  // ============ USER INFO ============
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
];
```

---

## Agent Capabilities by Google Product

### 1. Gmail Agent

```yaml
product: Gmail
api: Gmail API v1
capabilities:
  READ:
    - List email threads by customer
    - Search emails by keyword/date
    - Get thread details with all messages
    - Extract attachments
    - Analyze sentiment
    - Extract action items

  WRITE:
    - Create drafts with context
    - Apply labels for organization
    - Archive/mark as read
    - Forward to team members

  SEND (HITL):
    - Send emails (requires approval)
    - Send follow-ups
    - Send bulk (mail merge)

use_cases:
  - "Draft a check-in email for Acme Corp"
  - "Find all emails from Sarah at TechCo"
  - "What did the customer ask about last week?"
  - "Create follow-up for unanswered emails"
```

### 2. Calendar + Meet Agent

```yaml
products: [Google Calendar, Google Meet]
apis: [Calendar API v3, Meet REST API]
capabilities:
  CALENDAR:
    - List upcoming events
    - Check availability (free/busy)
    - Create events with Meet links
    - Update/reschedule events
    - Set reminders
    - Find optimal meeting times

  MEET:
    - Generate Meet links
    - Configure meeting settings
    - Access recordings (if enabled)
    - Get meeting transcripts (via Gemini)

use_cases:
  - "Schedule a QBR with Acme for next week"
  - "When is my next call with TechCo?"
  - "Find a time that works for all stakeholders"
  - "Prepare briefing for tomorrow's calls"
  - "Generate meeting summary from recording"
```

### 3. Drive + Docs + Sheets + Slides Agent

```yaml
products: [Drive, Docs, Sheets, Slides]
apis: [Drive API v3, Docs API v1, Sheets API v4, Slides API v1]
capabilities:
  DRIVE:
    - Browse customer folders
    - Search files by name/content
    - Upload files
    - Share with permissions
    - Organize with folders

  DOCS:
    - Create from templates
    - Generate success plans
    - Write meeting notes
    - Create proposals
    - Export to PDF

  SHEETS:
    - Create tracking sheets
    - Update customer data
    - Generate reports
    - Formula automation
    - Import/export CSV

  SLIDES:
    - Generate QBR decks
    - Create from templates
    - Insert charts from Sheets
    - Add speaker notes
    - Export to PDF

use_cases:
  - "Create a success plan for Acme Corp"
  - "Generate a QBR deck for TechCo"
  - "Find the latest contract for BigClient"
  - "Create a health tracking spreadsheet"
  - "Share the onboarding doc with stakeholders"
```

### 4. Tasks Agent

```yaml
product: Google Tasks
api: Tasks API v1
capabilities:
  - Create task lists per customer
  - Add tasks with due dates
  - Assign priorities
  - Track completion
  - Sync with Calendar

use_cases:
  - "Create onboarding checklist for new customer"
  - "Add follow-up task for next week"
  - "What tasks are overdue?"
  - "Mark kickoff tasks as complete"
```

### 5. Contacts + Directory Agent

```yaml
products: [Google Contacts, Directory API]
apis: [People API v1, Admin Directory API]
capabilities:
  - Look up customer contacts
  - Get org chart information
  - Find decision makers
  - Sync stakeholder data
  - Auto-enrich contact info

use_cases:
  - "Who is the VP of Engineering at Acme?"
  - "Get contact details for Sarah at TechCo"
  - "Map the stakeholders at BigClient"
```

### 6. Chat Agent (Internal Notifications)

```yaml
product: Google Chat
api: Chat API v1
capabilities:
  - Send notifications to CSM
  - Post to team spaces
  - Alert on urgent items
  - Share customer updates

use_cases:
  - "Alert me when customer emails arrive"
  - "Post renewal reminders to team space"
  - "Notify team of at-risk account"
```

### 7. Forms Agent (Feedback)

```yaml
product: Google Forms
api: Forms API v1
capabilities:
  - Create NPS surveys
  - Generate feedback forms
  - Collect responses
  - Analyze results

use_cases:
  - "Send NPS survey to Acme contacts"
  - "Create onboarding feedback form"
  - "Analyze survey responses"
```

---

## Architecture: Google-Native

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CSCX.AI GOOGLE-NATIVE ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              ┌───────────────┐                              │
│                              │   CSCX.AI     │                              │
│                              │   Frontend    │                              │
│                              │   (React)     │                              │
│                              └───────┬───────┘                              │
│                                      │                                      │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         GOOGLE CLOUD RUN                              │ │
│  │                         (CSCX.AI Backend)                             │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                    GOOGLE INTEGRATION HUB                        │ │ │
│  │  │                                                                   │ │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │ │ │
│  │  │  │ Gmail    │ │ Calendar │ │ Drive    │ │ Meet     │           │ │ │
│  │  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │           │ │ │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │ │ │
│  │  │       │            │            │            │                  │ │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │ │ │
│  │  │  │ Docs     │ │ Sheets   │ │ Slides   │ │ Tasks    │           │ │ │
│  │  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │           │ │ │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │ │ │
│  │  │       │            │            │            │                  │ │ │
│  │  │       └────────────┴────────────┴────────────┘                  │ │ │
│  │  │                           │                                      │ │ │
│  │  │                           ▼                                      │ │ │
│  │  │              ┌─────────────────────────┐                        │ │ │
│  │  │              │   Google OAuth Handler  │                        │ │ │
│  │  │              │   (Single Auth Flow)    │                        │ │ │
│  │  │              └─────────────────────────┘                        │ │ │
│  │  │                                                                   │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                      AGENT ENGINE                                │ │ │
│  │  │                                                                   │ │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │ │ │
│  │  │  │ Email    │ │ Meeting  │ │ Document │ │ Workflow │           │ │ │
│  │  │  │ Agent    │ │ Agent    │ │ Agent    │ │ Agent    │           │ │ │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                      │                                      │
│         ┌────────────────────────────┼────────────────────────────┐        │
│         │                            │                            │        │
│         ▼                            ▼                            ▼        │
│  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐    │
│  │  SUPABASE   │            │  GEMINI AI  │            │  VERTEX AI  │    │
│  │             │            │             │            │             │    │
│  │ • Auth      │            │ • Chat      │            │ • Embeddings│    │
│  │ • Database  │            │ • Vision    │            │ • Vector    │    │
│  │ • pgvector  │            │ • Code      │            │ • Search    │    │
│  │ • Storage   │            │ • Summary   │            │             │    │
│  └─────────────┘            └─────────────┘            └─────────────┘    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         GOOGLE WORKSPACE APIs                         │ │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │ │
│  │  │Gmail│ │ Cal │ │Meet │ │Drive│ │Docs │ │Sheet│ │Slide│ │Tasks│   │ │
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Updates

```sql
-- Google OAuth tokens (single table for all Google services)
CREATE TABLE google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,

  -- Granted scopes (what user consented to)
  granted_scopes TEXT[] NOT NULL,

  -- Account info
  google_email TEXT NOT NULL,
  google_user_id TEXT NOT NULL,

  -- Status
  is_valid BOOLEAN DEFAULT true,
  last_refresh_at TIMESTAMPTZ,
  last_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Synced Gmail threads
CREATE TABLE gmail_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),

  -- Gmail identifiers
  gmail_thread_id TEXT NOT NULL,
  gmail_history_id TEXT,

  -- Thread data
  subject TEXT,
  snippet TEXT,
  participants TEXT[],
  labels TEXT[],

  -- Analysis
  sentiment TEXT, -- 'positive', 'neutral', 'negative'
  action_items JSONB DEFAULT '[]',
  requires_response BOOLEAN DEFAULT false,
  urgency TEXT, -- 'low', 'medium', 'high'

  -- Metadata
  message_count INTEGER,
  last_message_at TIMESTAMPTZ,
  is_unread BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, gmail_thread_id)
);

-- Synced calendar events
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),

  -- Calendar identifiers
  google_event_id TEXT NOT NULL,
  google_calendar_id TEXT NOT NULL,

  -- Event data
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT,

  -- Attendees
  attendees JSONB DEFAULT '[]',
  organizer_email TEXT,

  -- Meeting link
  meet_link TEXT,
  conference_id TEXT,

  -- AI-generated content
  prep_brief JSONB, -- Generated 24h before
  summary JSONB,    -- Generated after meeting
  action_items JSONB DEFAULT '[]',

  -- Recording (if available)
  recording_url TEXT,
  transcript TEXT,

  -- Classification
  meeting_type TEXT, -- 'kickoff', 'check-in', 'qbr', 'training', 'escalation', 'other'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, google_event_id)
);

-- Synced Drive files
CREATE TABLE drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),

  -- Drive identifiers
  google_file_id TEXT NOT NULL,
  google_folder_id TEXT,

  -- File data
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  web_view_link TEXT,
  icon_link TEXT,

  -- Classification
  file_type TEXT, -- 'doc', 'sheet', 'slide', 'pdf', 'other'
  category TEXT,  -- 'contract', 'success_plan', 'qbr', 'notes', 'other'

  -- Indexing for RAG
  is_indexed BOOLEAN DEFAULT false,
  indexed_at TIMESTAMPTZ,
  chunk_count INTEGER,

  -- Metadata
  size_bytes BIGINT,
  created_time TIMESTAMPTZ,
  modified_time TIMESTAMPTZ,
  last_modifying_user TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, google_file_id)
);

-- Google Tasks
CREATE TABLE google_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),

  -- Task identifiers
  google_task_id TEXT NOT NULL,
  google_tasklist_id TEXT NOT NULL,

  -- Task data
  title TEXT NOT NULL,
  notes TEXT,
  due_date DATE,
  status TEXT DEFAULT 'needsAction', -- 'needsAction', 'completed'
  completed_at TIMESTAMPTZ,

  -- CSCX metadata
  task_type TEXT, -- 'follow_up', 'onboarding', 'renewal', 'other'
  priority TEXT,  -- 'low', 'medium', 'high'
  source TEXT,    -- 'agent', 'user', 'email', 'meeting'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, google_task_id)
);
```

---

## Service Layer Structure

```
server/src/services/google/
├── index.ts                 # Export all Google services
├── oauth.ts                 # OAuth flow, token refresh
├── gmail.ts                 # Gmail API operations
├── calendar.ts              # Calendar API operations
├── meet.ts                  # Meet API operations
├── drive.ts                 # Drive API operations
├── docs.ts                  # Docs API operations
├── sheets.ts                # Sheets API operations
├── slides.ts                # Slides API operations
├── tasks.ts                 # Tasks API operations
├── contacts.ts              # Contacts/People API
├── chat.ts                  # Chat API operations
└── forms.ts                 # Forms API operations

server/src/services/google/types.ts  # Shared types
```

---

## API Routes Structure

```
/api/google
├── /auth
│   ├── GET    /connect              # Start OAuth flow
│   ├── GET    /callback             # OAuth callback
│   ├── GET    /status               # Check connection status
│   ├── POST   /refresh              # Force token refresh
│   └── DELETE /disconnect           # Revoke access
│
├── /gmail
│   ├── GET    /threads              # List threads
│   ├── GET    /threads/:id          # Get thread details
│   ├── GET    /threads/:id/messages # Get messages
│   ├── POST   /drafts               # Create draft
│   ├── POST   /send                 # Send email
│   └── POST   /labels               # Apply labels
│
├── /calendar
│   ├── GET    /events               # List events
│   ├── GET    /events/:id           # Get event details
│   ├── POST   /events               # Create event
│   ├── PUT    /events/:id           # Update event
│   ├── DELETE /events/:id           # Delete event
│   ├── GET    /freebusy             # Check availability
│   └── GET    /events/:id/brief     # Get AI prep brief
│
├── /meet
│   ├── POST   /spaces               # Create meeting
│   └── GET    /spaces/:id           # Get meeting info
│
├── /drive
│   ├── GET    /files                # List files
│   ├── GET    /files/:id            # Get file details
│   ├── GET    /files/:id/content    # Get file content
│   ├── POST   /files                # Upload file
│   ├── POST   /files/:id/copy       # Copy file
│   ├── POST   /files/:id/index      # Index for RAG
│   └── GET    /folders/:id          # List folder contents
│
├── /docs
│   ├── POST   /                     # Create doc
│   ├── GET    /:id                  # Get doc content
│   ├── PUT    /:id                  # Update doc
│   └── POST   /from-template        # Create from template
│
├── /sheets
│   ├── POST   /                     # Create sheet
│   ├── GET    /:id                  # Get sheet data
│   ├── PUT    /:id/values           # Update values
│   └── POST   /from-template        # Create from template
│
├── /slides
│   ├── POST   /                     # Create presentation
│   ├── GET    /:id                  # Get presentation
│   └── POST   /from-template        # Create from template
│
├── /tasks
│   ├── GET    /lists                # List task lists
│   ├── POST   /lists                # Create task list
│   ├── GET    /lists/:id/tasks      # List tasks
│   ├── POST   /lists/:id/tasks      # Create task
│   ├── PUT    /tasks/:id            # Update task
│   └── POST   /tasks/:id/complete   # Mark complete
│
├── /contacts
│   ├── GET    /                     # List contacts
│   ├── GET    /:id                  # Get contact
│   ├── GET    /search               # Search contacts
│   └── GET    /directory            # Org directory
│
└── /forms
    ├── POST   /                     # Create form
    ├── GET    /:id                  # Get form
    └── GET    /:id/responses        # Get responses
```

---

## Template Library (Google Docs)

### Pre-built Templates

| Template | Type | Purpose |
|----------|------|---------|
| Success Plan | Doc | Customer success roadmap |
| QBR Deck | Slides | Quarterly business review |
| Onboarding Tracker | Sheet | Task tracking |
| Meeting Notes | Doc | Call documentation |
| Health Scorecard | Sheet | Customer health tracking |
| NPS Survey | Form | Customer feedback |
| Escalation Report | Doc | Issue documentation |
| Renewal Proposal | Doc | Renewal documentation |

### Template Variables

```typescript
interface TemplateVariables {
  // Customer
  customer_name: string;
  customer_logo_url?: string;
  contract_start_date: string;
  contract_end_date: string;
  arr: number;

  // Stakeholders
  stakeholders: Stakeholder[];
  champion_name: string;
  executive_sponsor: string;

  // Metrics
  health_score: number;
  adoption_rate: number;
  nps_score: number;

  // CSM
  csm_name: string;
  csm_email: string;
  csm_phone: string;

  // Dates
  current_date: string;
  next_renewal_date: string;
  days_to_renewal: number;
}
```

---

## Agent Use Cases by Product

### Comprehensive Examples

```
USER: "Prepare me for my call with Acme tomorrow"

AGENT ACTIONS:
1. [Calendar] Get meeting details
2. [Gmail] Fetch recent email threads with Acme
3. [Drive] Find related documents
4. [Contacts] Get stakeholder info
5. [Knowledge] Retrieve relevant playbooks
6. [Docs] Generate meeting brief

OUTPUT: Comprehensive prep document with:
- Meeting details (time, attendees, agenda)
- Recent email summary
- Open action items
- Customer health signals
- Suggested talking points
- Risk areas to address
```

```
USER: "Create a QBR for TechCo"

AGENT ACTIONS:
1. [Sheets] Pull health metrics data
2. [Drive] Find usage/adoption data
3. [Calendar] Get meeting history
4. [Gmail] Summarize key communications
5. [Slides] Generate QBR deck from template
6. [Drive] Save to customer folder
7. [Calendar] Schedule QBR meeting
8. [Gmail] Send invite with agenda

OUTPUT:
- QBR deck created in Drive
- Meeting scheduled with Meet link
- Invite sent to stakeholders
```

```
USER: "Set up onboarding for new customer BigCorp"

AGENT ACTIONS:
1. [Drive] Create customer folder structure
2. [Docs] Generate success plan from template
3. [Sheets] Create onboarding tracker
4. [Tasks] Create onboarding task list
5. [Calendar] Schedule kickoff meeting
6. [Gmail] Draft welcome email
7. [Contacts] Add stakeholder contacts

OUTPUT:
- Full folder structure created
- Success plan ready for review
- Onboarding tasks created
- Kickoff meeting scheduled
- Welcome email drafted (pending approval)
```

---

## Implementation Priority

### Week 1 Focus

| Priority | Google Product | Agent Capability |
|----------|---------------|------------------|
| P0 | OAuth | Single sign-on to all Google |
| P0 | Gmail | Read, draft, send |
| P0 | Calendar | Read, create with Meet |
| P0 | Drive | Browse, search, index |
| P1 | Docs | Create from template |
| P1 | Tasks | Create and track |
| P2 | Sheets | Create tracking sheets |
| P2 | Slides | Generate QBR decks |
| P3 | Contacts | Lookup stakeholders |
| P3 | Forms | NPS surveys |
| P3 | Chat | Internal notifications |

---

*This document defines CSCX.AI's deep integration with Google Workspace, enabling agents to leverage the full power of Google's productivity suite.*
