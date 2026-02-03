/**
 * Outlook Services Index
 * Exports all Microsoft Outlook/Graph service modules
 * PRD-189: Outlook Calendar Integration
 */

// OAuth
export { MicrosoftOAuthService, microsoftOAuth, MICROSOFT_SCOPES } from './oauth.js';
export type { MicrosoftTokens, MicrosoftUserInfo } from './oauth.js';

// Calendar
export { OutlookCalendarService, outlookCalendarService } from './calendar.js';
export type {
  OutlookCalendarEvent,
  OutlookEventAttendee,
  OutlookRecurrence,
  CreateOutlookEventOptions,
  UpdateOutlookEventOptions,
  FreeBusySlot,
  MeetingTimeSuggestion,
} from './calendar.js';
