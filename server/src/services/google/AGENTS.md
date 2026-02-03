# Google Workspace Services - Agent Instructions

## Overview

Full Google Workspace integration: OAuth, Gmail, Calendar, Drive, Docs, Sheets, Slides, Apps Script.

## Service Files

```
google/
├── oauth.ts       # Token management, refresh, scopes
├── gmail.ts       # Send, draft, threads, labels
├── calendar.ts    # Events, availability, Meet links
├── drive.ts       # Files, folders, sharing, search
├── docs.ts        # Document creation with templates
├── sheets.ts      # Spreadsheet creation with templates
├── slides.ts      # Presentation creation with templates
├── scripts.ts     # Apps Script deployment and execution
├── workspace.ts   # Per-customer workspace isolation
├── approval.ts    # HITL policies for Google actions
├── agentActions.ts # Unified interface for agents
└── index.ts       # Service exports
```

## OAuth Flow

```typescript
// Step 1: Generate auth URL
import { getGoogleAuthUrl } from './oauth';

const scopes = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive'
];

const authUrl = getGoogleAuthUrl(scopes, { userId, returnTo });
// Redirect user to authUrl

// Step 2: Handle callback
import { exchangeCodeForTokens, saveTokens } from './oauth';

const tokens = await exchangeCodeForTokens(code);
await saveTokens(userId, tokens);

// Step 3: Use authenticated client
import { getAuthenticatedClient } from './oauth';

const auth = await getAuthenticatedClient(userId);
// auth is ready to use with Google APIs
```

## Token Refresh

```typescript
// oauth.ts handles automatic refresh
export async function getAuthenticatedClient(userId: string) {
  const tokens = await getStoredTokens(userId);

  if (!tokens) {
    throw new ServiceError('NO_GOOGLE_AUTH', 'User not connected to Google');
  }

  // Check if token needs refresh (expires in < 5 minutes)
  if (tokens.expiry_date < Date.now() + 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    await saveTokens(userId, refreshed);
    return createOAuth2Client(refreshed);
  }

  return createOAuth2Client(tokens);
}
```

## Gmail Service

```typescript
// gmail.ts
export const gmailService = {
  /**
   * Create a draft email (no approval needed)
   */
  async createDraft(userId: string, options: DraftOptions): Promise<Draft> {
    const auth = await getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const message = createMimeMessage(options);

    const { data } = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: { raw: Buffer.from(message).toString('base64url') }
      }
    });

    return data;
  },

  /**
   * Send email (REQUIRES APPROVAL)
   */
  async sendEmail(userId: string, options: EmailOptions): Promise<Message> {
    const auth = await getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const message = createMimeMessage(options);

    const { data } = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: Buffer.from(message).toString('base64url') }
    });

    return data;
  },

  /**
   * Get thread for context
   */
  async getThread(userId: string, threadId: string): Promise<Thread> {
    const auth = await getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const { data } = await gmail.users.threads.get({
      userId: 'me',
      id: threadId
    });

    return data;
  }
};
```

## Calendar Service

```typescript
// calendar.ts
export const calendarService = {
  /**
   * Check availability for meeting scheduling
   */
  async getAvailability(userId: string, options: AvailabilityOptions) {
    const auth = await getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const { data } = await calendar.freebusy.query({
      requestBody: {
        timeMin: options.startDate,
        timeMax: options.endDate,
        items: options.calendars.map(id => ({ id }))
      }
    });

    return data;
  },

  /**
   * Create calendar event (REQUIRES APPROVAL)
   */
  async createEvent(userId: string, options: EventOptions): Promise<Event> {
    const auth = await getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1, // Enable Google Meet
      sendUpdates: 'all',
      requestBody: {
        summary: options.title,
        description: options.description,
        start: { dateTime: options.startTime, timeZone: options.timezone },
        end: { dateTime: options.endTime, timeZone: options.timezone },
        attendees: options.attendees.map(email => ({ email })),
        conferenceData: options.includeMeet ? {
          createRequest: { requestId: crypto.randomUUID() }
        } : undefined
      }
    });

    return data;
  }
};
```

## Drive Service

```typescript
// drive.ts
export const driveService = {
  /**
   * Create customer workspace folder structure
   */
  async createCustomerWorkspace(userId: string, customerName: string) {
    const auth = await getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });

    // Create root folder
    const rootFolder = await this.createFolder(auth, `CSCX - ${customerName}`);

    // Create subfolders
    const subfolders = [
      '01 - Onboarding',
      '02 - Meetings',
      '03 - QBRs',
      '04 - Contracts',
      '05 - Reports'
    ];

    for (const name of subfolders) {
      await this.createFolder(auth, name, rootFolder.id);
    }

    return rootFolder;
  },

  /**
   * Upload file to Drive
   */
  async uploadFile(userId: string, options: UploadOptions) {
    const auth = await getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });

    const { data } = await drive.files.create({
      requestBody: {
        name: options.name,
        parents: options.folderId ? [options.folderId] : undefined
      },
      media: {
        mimeType: options.mimeType,
        body: options.content
      }
    });

    return data;
  },

  /**
   * Share file (REQUIRES APPROVAL)
   */
  async shareFile(userId: string, fileId: string, email: string, role: 'reader' | 'writer') {
    const auth = await getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });

    await drive.permissions.create({
      fileId,
      sendNotificationEmail: true,
      requestBody: {
        type: 'user',
        role,
        emailAddress: email
      }
    });
  }
};
```

## Template System

### Template Variables
All templates support `{{placeholder}}` syntax:

```typescript
const variables = {
  customer_name: 'Acme Corp',
  csm_name: 'John Smith',
  csm_email: 'john@company.com',
  renewal_date: 'March 15, 2025',
  health_score: '85',
  arr: '$150,000',
  // ... any custom variables
};
```

### Document Templates (Docs)
```typescript
// docs.ts
export const DOC_TEMPLATES = {
  qbr_report: 'QBR Report Template',
  meeting_notes: 'Meeting Notes Template',
  onboarding_plan: 'Onboarding Plan Template',
  success_plan: 'Success Plan Template',
  renewal_proposal: 'Renewal Proposal Template',
  value_summary: 'Value Summary Template',
  escalation_report: 'Escalation Report Template'
};

export async function createDocFromTemplate(
  userId: string,
  template: keyof typeof DOC_TEMPLATES,
  variables: Record<string, string>,
  folderId?: string
): Promise<Doc> {
  // Clone template and replace variables
}
```

### Spreadsheet Templates (Sheets)
```typescript
// sheets.ts
export const SHEET_TEMPLATES = {
  health_tracker: 'Health Score Tracker',
  renewal_tracker: 'Renewal Pipeline Tracker',
  onboarding_tracker: 'Onboarding Checklist',
  usage_metrics: 'Usage Metrics Dashboard',
  customer_scorecard: 'Customer Scorecard',
  risk_dashboard: 'Risk Signal Dashboard'
};
```

### Presentation Templates (Slides)
```typescript
// slides.ts
export const SLIDE_TEMPLATES = {
  qbr_presentation: 'QBR Presentation',
  kickoff_deck: 'Customer Kickoff Deck',
  training_presentation: 'Training Presentation',
  renewal_presentation: 'Renewal Presentation',
  executive_briefing: 'Executive Briefing'
};
```

## HITL Policy Matrix

| Action | Requires Approval | Reason |
|--------|------------------|--------|
| `draft_email` | No | Read-only, no external impact |
| `send_email` | **Yes** | External communication |
| `get_calendar` | No | Read-only |
| `create_event` | **Yes** | Commits attendee time |
| `search_drive` | No | Read-only |
| `upload_file` | No | Internal only |
| `share_file` | **Yes** | External sharing |
| `create_doc` | No | Internal only |
| `delete_file` | **Never** | Dangerous, blocked |

## Common Gotchas

### 1. Always Use getAuthenticatedClient
```typescript
// ❌ BAD - tokens may be expired
const auth = createOAuth2Client(storedTokens);

// ✅ GOOD - handles refresh automatically
const auth = await getAuthenticatedClient(userId);
```

### 2. Check Token Existence
```typescript
// ❌ BAD - assumes user is connected
const auth = await getAuthenticatedClient(userId);

// ✅ GOOD - handle not connected
try {
  const auth = await getAuthenticatedClient(userId);
} catch (error) {
  if (error.code === 'NO_GOOGLE_AUTH') {
    return { needsAuth: true, authUrl: getGoogleAuthUrl(...) };
  }
  throw error;
}
```

### 3. Rate Limiting
```typescript
// Google API quotas:
// - Gmail: 500 messages/day per user
// - Calendar: 1,000,000 queries/day
// - Drive: 1,000 queries/100 seconds

// Use batch requests for multiple operations
const batch = drive.newBatch();
files.forEach(file => batch.add(drive.files.get({ fileId: file.id })));
await batch.execute();
```

### 4. Per-Customer Isolation
```typescript
// ❌ BAD - mixing customer data
await driveService.uploadFile(userId, { folderId: genericFolderId, ... });

// ✅ GOOD - customer-specific folder
const workspace = await workspaceService.getOrCreate(customerId);
await driveService.uploadFile(userId, { folderId: workspace.folderId, ... });
```
