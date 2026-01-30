# PRD-207: Loom Video Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-207 |
| **Title** | Loom Video Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P3 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs create Loom videos for customer training, walkthroughs, and support responses but these videos are not linked to customer records. Video engagement data (views, completion rates) that could inform customer health is not tracked in the customer success context.

## User Stories

### Primary User Stories
1. **As a CSM**, I want Loom videos I share with customers linked to their records for context.
2. **As a CSM**, I want to see if customers have watched training videos I sent them.
3. **As CSCX.AI**, I want video engagement metrics to inform customer adoption scoring.

### Secondary User Stories
4. **As a CSM**, I want to quickly share Loom videos from the customer context in CSCX.AI.
5. **As a CS Leader**, I want to see which video content resonates with customers.

## Functional Requirements

### FR-1: OAuth Authentication
- Support Loom OAuth 2.0
- Request video and analytics scopes
- User-level connection

### FR-2: Video Sync
- Pull videos shared with customers
- Sync video metadata:
  - Title, description
  - Duration
  - Share URL
  - Created date
- Match to customers via share recipients

### FR-3: Engagement Tracking
- Pull view analytics:
  - View count
  - Unique viewers
  - Completion rate
  - CTA clicks
- Track viewer identity when available

### FR-4: Customer Linking
- Auto-link via recipient email
- Manual video-customer association
- Tag videos for customer context

### FR-5: Video Sharing
- Share existing Looms from CSCX.AI
- Generate share links
- Track sharing in activity log

### FR-6: Content Library
- Organize training videos
- Tag for customer segments
- Recommend videos based on context

## Non-Functional Requirements

### NFR-1: Performance
- Analytics refresh daily
- Share link generation < 3 seconds

### NFR-2: Privacy
- Respect Loom sharing settings
- Handle anonymous viewers

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/loom/connect
GET    /api/integrations/loom/callback
GET    /api/loom/videos
GET    /api/loom/videos/:videoId
GET    /api/loom/videos/:videoId/analytics
POST   /api/loom/share
GET    /api/loom/customer/:customerId
```

### Loom API Usage
```javascript
// List videos
GET https://developer.loom.com/v1/videos
Authorization: Bearer {access_token}

// Get video details
GET https://developer.loom.com/v1/videos/{video_id}

// Get analytics
GET https://developer.loom.com/v1/videos/{video_id}/insights
```

### Database Schema
```sql
CREATE TABLE loom_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loom_id TEXT UNIQUE,
  user_id TEXT,
  title TEXT,
  description TEXT,
  duration_seconds INTEGER,
  share_url TEXT,
  embed_url TEXT,
  created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
);

CREATE TABLE loom_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loom_id TEXT REFERENCES loom_videos(loom_id),
  customer_id UUID REFERENCES customers(id),
  shared_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  completion_rate NUMERIC
);
```

## User Interface

### Video Library
- Video grid with thumbnails
- Filter by customer/tag
- Engagement indicators

### Customer Videos
- Videos shared with customer
- Watch status
- Engagement metrics

### Quick Share
- Select video from library
- Add to customer context
- Copy share link

## Acceptance Criteria

### AC-1: Connection
- [ ] OAuth completes successfully
- [ ] Videos sync correctly

### AC-2: Functionality
- [ ] Customer linking works
- [ ] Engagement tracking accurate
- [ ] Sharing works

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show Loom videos for [account]" | Display videos |
| "Has [account] watched the training video?" | Check engagement |
| "Share onboarding video with [account]" | Generate share |

## Success Metrics
| Metric | Target |
|--------|--------|
| Video sync accuracy | > 99% |
| Engagement tracking | Daily refresh |

## Related PRDs
- PRD-038: Training Invitation Personalization
- PRD-017: Training Completion Data
