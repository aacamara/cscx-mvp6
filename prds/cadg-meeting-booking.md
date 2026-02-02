# CADG Meeting Booking from Meeting Prep

## Overview

Extend the CADG Meeting Prep HITL workflow to include meeting booking. After reviewing and saving meeting prep, users can book the actual meeting with one click, using the existing Google Calendar API infrastructure.

## User Flow

1. User creates meeting prep via CADG → reviews in preview modal
2. User clicks "Save & Book Meeting" (new) OR "Save Meeting Prep" (existing)
3. If booking: Meeting booking modal appears with pre-filled data
4. User selects date/time, confirms attendees, toggles Meet link
5. Meeting is created in Google Calendar with prep doc linked
6. Activity logged to customer timeline

## Features

### 1. Meeting Booking Modal Component
- Pre-filled title from meeting prep
- Pre-filled attendees from meeting prep
- Date picker for meeting date
- Time picker with 15-min increments
- Duration dropdown (15min, 30min, 45min, 1hr, 1.5hr, 2hr)
- "Add Google Meet link" toggle (default on)
- "Check Availability" button showing busy times
- Description auto-populated with agenda items
- Link to meeting prep document in description
- Cancel and "Book Meeting" buttons

### 2. Save & Book Flow
- New primary button in CADGMeetingPrepPreview: "Save & Book Meeting"
- Existing "Save Meeting Prep" becomes secondary action
- On "Save & Book": save prep first, then show booking modal
- Booking modal receives prep document URL to include in invite

### 3. Availability Checking
- Uses existing `POST /api/google/calendar/freebusy` endpoint
- Shows busy blocks for selected date
- Highlights suggested available slots
- Visual calendar strip showing availability

### 4. Meeting Creation API
- Uses existing `POST /api/google/calendar/meetings` endpoint
- Creates event with Google Meet link
- Adds meeting prep doc URL to description
- Invites all attendees from prep
- Returns event URL for confirmation

### 5. Success State
- Shows confirmation with meeting details
- Links to Google Calendar event
- Links to meeting prep document
- Option to copy meeting link
- Closes modal, updates plan card status

## API Endpoints (Existing - No Changes Needed)

- `POST /api/google/calendar/meetings` - Create meeting with Meet link
- `POST /api/google/calendar/freebusy` - Check availability
- `GET /api/google/calendar/calendars` - List user calendars

## New/Modified Files

| File | Change |
|------|--------|
| `components/AIPanel/CADGMeetingBookingModal.tsx` | NEW - Booking modal component |
| `components/AIPanel/CADGMeetingPrepPreview.tsx` | MODIFY - Add "Save & Book" button |
| `components/AIPanel/CADGPlanCard.tsx` | MODIFY - Handle booking flow |

## Component Props

### CADGMeetingBookingModal

```typescript
interface MeetingBookingData {
  title: string;
  attendees: string[];
  agenda: string[];
  prepDocumentUrl?: string;
}

interface CADGMeetingBookingModalProps {
  initialData: MeetingBookingData;
  onBook: (meeting: BookedMeeting) => Promise<void>;
  onCancel: () => void;
}

interface BookedMeeting {
  eventId: string;
  eventUrl: string;
  meetLink?: string;
  startTime: string;
  endTime: string;
}
```

## User Stories

### US-001: Create CADGMeetingBookingModal component shell
- Modal with teal-themed styling matching other CADG modals
- Title input (pre-filled, editable)
- Attendees list (pre-filled from meeting prep)
- Cancel and Book Meeting buttons
- Loading state during booking

### US-002: Add date and time selection
- Date picker for selecting meeting date
- Time picker with 15-minute increments (9:00 AM - 6:00 PM)
- Duration dropdown with common options
- Default to next business day, 10:00 AM, 1 hour

### US-003: Add Google Meet toggle and description
- Checkbox "Add Google Meet video call" (default checked)
- Auto-generated description from agenda items
- Meeting prep document link appended to description
- Calendar selector if user has multiple calendars

### US-004: Add availability checking UI
- "Check Availability" button
- Shows loading spinner while checking
- Displays busy times for selected date as colored blocks
- Suggests first 3 available slots
- Click suggestion to auto-fill time

### US-005: Integrate booking modal into meeting prep flow
- Add "Save & Book Meeting" primary button to CADGMeetingPrepPreview
- Make "Save Meeting Prep" a secondary/text button
- On Save & Book: save prep first, then show booking modal
- Pass prep document URL to booking modal

### US-006: Handle booking API call
- Call POST /api/google/calendar/meetings on book
- Include title, attendees, start/end time, description, meet link option
- Handle loading, success, and error states
- On success, close modal and update plan card

### US-007: Show booking success state
- Display confirmation message with meeting details
- Show clickable links: Calendar event, Google Meet, Prep document
- "Copy Meeting Link" button for quick sharing
- Auto-close after 5 seconds or on user dismiss

### US-008: Update CADGPlanCard for booking flow
- Track booking state separate from prep save state
- Show "Meeting Booked" badge when complete
- Display meeting link in completed artifact
- Handle booking errors gracefully
