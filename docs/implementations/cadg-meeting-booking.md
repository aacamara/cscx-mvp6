# CADG Meeting Booking

## Overview

Book calendar meetings directly from the CADG Meeting Prep HITL workflow. After preparing meeting content, users can schedule the actual meeting with pre-filled data using existing Google Calendar API infrastructure.

## Features

### 1. Meeting Booking Modal (`components/AIPanel/CADGMeetingBookingModal.tsx`)
- Pre-filled title and attendees from meeting prep
- Date picker (defaults to next business day)
- Time picker with 15-minute increments
- Duration dropdown (15min to 2hr)
- Google Meet video call toggle
- Auto-generated description from agenda
- Meeting prep document link in description
- Availability checking with suggested slots
- Success confirmation with links

### 2. Save & Book Flow
- "Save & Book Meeting" primary button in meeting prep preview
- "Save Only" secondary button for saving without booking
- Sequential flow: save prep → show booking modal
- Prep document URL passed to booking modal

### 3. Availability Checking
- Uses `POST /api/google/calendar/freebusy`
- Shows busy time indicators
- Suggests up to 3 available slots
- Click to auto-fill time selection

### 4. Calendar Integration
- Uses `POST /api/google/calendar/meetings`
- Creates event with optional Google Meet link
- Invites all attendees from prep
- Links back to meeting prep document

## Architecture

```
Meeting Prep Preview
         |
         v
+-----------------------------------------+
| User clicks "Save & Book Meeting"       |
+-----------------------------------------+
         |
         v
+-----------------------------------------+
| POST /api/cadg/meeting-prep/save        |
| Returns: { documentUrl }                |
+-----------------------------------------+
         |
         v
+-----------------------------------------+
| CADGMeetingBookingModal                 |
| - Pre-filled from meeting prep          |
| - Select date/time/duration             |
| - Check availability                    |
| - Book meeting                          |
+-----------------------------------------+
         |
         v (User clicks "Book Meeting")
+-----------------------------------------+
| POST /api/google/calendar/meetings      |
| Creates: Calendar event + Meet link     |
+-----------------------------------------+
         |
         v
+-----------------------------------------+
| Success Confirmation                    |
| - Calendar event link                   |
| - Google Meet link                      |
| - Meeting prep document link            |
| - Copy meeting link button              |
+-----------------------------------------+
```

## API Endpoints (Existing)

### POST /api/google/calendar/meetings
Creates a calendar event with optional Google Meet link.

**Request:**
```json
{
  "title": "QBR Prep - Acme Corp",
  "attendees": ["john@acme.com", "sarah@acme.com"],
  "startTime": "2026-02-03T10:00:00",
  "endTime": "2026-02-03T11:00:00",
  "description": "Agenda:\n• Q4 Review\n• Roadmap Discussion",
  "addMeet": true
}
```

**Response:**
```json
{
  "id": "event-id",
  "htmlLink": "https://calendar.google.com/...",
  "hangoutLink": "https://meet.google.com/..."
}
```

### POST /api/google/calendar/freebusy
Check availability for attendees.

**Request:**
```json
{
  "timeMin": "2026-02-03T09:00:00",
  "timeMax": "2026-02-03T18:00:00",
  "attendees": ["john@acme.com"]
}
```

**Response:**
```json
{
  "calendars": {
    "john@acme.com": {
      "busy": [
        { "start": "2026-02-03T10:00:00", "end": "2026-02-03T11:00:00" }
      ]
    }
  }
}
```

## Files

| File | Purpose |
|------|---------|
| `components/AIPanel/CADGMeetingBookingModal.tsx` | Meeting booking modal component |
| `components/AIPanel/CADGMeetingPrepPreview.tsx` | Modified - added Save & Book button |
| `components/AIPanel/CADGPlanCard.tsx` | Modified - integrated booking flow |

## Component Props

### CADGMeetingBookingModal

```typescript
interface MeetingBookingData {
  title: string;
  attendees: string[];
  agenda: string[];
  prepDocumentUrl?: string;
}

interface BookedMeeting {
  eventId: string;
  eventUrl: string;
  meetLink?: string;
  startTime: string;
  endTime: string;
}

interface CADGMeetingBookingModalProps {
  initialData: MeetingBookingData;
  onBook: (meeting: BookedMeeting) => Promise<void>;
  onCancel: () => void;
}
```

## User Flow

1. User prepares meeting content via CADG Meeting Prep HITL workflow
2. User reviews/edits meeting prep in preview modal
3. User clicks "Save & Book Meeting" (primary action)
4. Meeting prep saved to Google Docs
5. Booking modal appears with pre-filled data:
   - Title from meeting prep
   - Attendees from meeting prep
   - Agenda items in description
   - Link to meeting prep document
6. User selects date, time, and duration
7. User can check availability to see busy times and suggestions
8. User clicks "Book Meeting"
9. Calendar event created with Google Meet link
10. Success confirmation shows:
    - Meeting details
    - Link to Google Calendar event
    - Link to Google Meet
    - Link to meeting prep document
    - Copy meeting link button
11. User clicks "Done" to close modal
12. Plan card shows "Meeting Booked" status with links

## Status

- Complete - All 8 user stories implemented

- US-001: CADGMeetingBookingModal component shell
- US-002: Date and time selection
- US-003: Google Meet toggle and description
- US-004: Availability checking UI
- US-005: Save & Book button in meeting prep preview
- US-006: Meeting booking API call
- US-007: Booking success confirmation
- US-008: CADGPlanCard integration
