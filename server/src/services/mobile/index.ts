/**
 * Mobile Services Index (PRD-264, PRD-266, PRD-268)
 * Exports all mobile-related service modules
 */

export {
  VoiceCommandService,
  voiceCommandService,
} from './voiceCommands.js';

export type {
  VoiceCommand,
  CommandMatch,
  VoiceCommandResult,
  VoiceSettings,
  CustomerMatch,
} from './voiceCommands.js';

// PRD-266: Apple Watch Integration & Biometric Authentication
export {
  BiometricAuthService,
  biometricAuthService,
} from './biometricAuth.js';

export type {
  BiometricCredential,
  DeviceRegistration,
  BiometricChallenge,
  AuthenticationResult,
  WatchPairingRequest,
  WatchPairingResult,
} from './biometricAuth.js';

export {
  WatchSyncService,
  watchSyncService,
} from './watchSync.js';

export type {
  WatchComplicationData,
  TaskSummary,
  CustomerSummary,
  PendingApproval,
  WatchDashboardData,
  QuickNoteRequest,
  QuickActionResult,
} from './watchSync.js';

// PRD-268: Location-Based Reminders
export {
  LocationRemindersService,
  locationRemindersService,
} from './locationReminders.js';

export type {
  CustomerLocation,
  LocationPreferences,
  ExcludedLocation,
  VisitLog,
  FollowUpTask,
  GeofenceEvent,
  Geofence,
  CustomerBrief,
  ActionItem,
  Stakeholder,
  Activity,
  NearbyLocation,
  VisitPattern,
  CreateLocationInput,
  UpdateLocationInput,
  UpdatePreferencesInput,
  StartVisitInput,
  EndVisitInput,
  LogGeofenceEventInput,
} from './locationReminders.js';

// PRD-265: Quick Actions Widget
export {
  quickActionsService,
} from './quickActions.js';

export type {
  WidgetType,
  WidgetSize,
  QuickActionType,
  CustomerSummary as QuickCustomerSummary,
  TaskSummary as QuickTaskSummary,
  PortfolioOverview,
  WidgetConfig,
  QuickNoteInput,
  QuickTaskInput,
  WidgetDataResponse,
  NotificationSummary,
} from './quickActions.js';

// PRD-267: Mobile Document Scanning
export {
  default as documentScanningService,
  processScannedDocument,
  performOCR,
  classifyDocument,
  searchDocuments,
  getDocumentById,
  getCustomerDocuments,
  deleteDocument,
  getScanStats,
} from './documentScanning.js';

export type {
  DocumentType,
  ScannedPage,
  BusinessCardData,
  ContractData,
  MeetingNotesData,
  OCRResult,
  TextBlock,
  DocumentClassification,
  ScannedDocument,
  ScanRequest,
  ScanResult,
} from './documentScanning.js';

// PRD-269: Mobile Meeting Notes
export {
  MobileMeetingNotesService,
  mobileMeetingNotesService,
  MEETING_TEMPLATES,
} from './meetingNotes.js';

export type {
  MeetingNote,
  Attendee,
  ActionItem as MeetingActionItem,
  Highlight,
  VoiceNote,
  RiskFlag,
  OpportunityFlag,
  OfflineChange,
  MeetingTemplateType,
  MeetingTemplate,
  ProcessedMeetingNotes,
  CalendarMeeting,
} from './meetingNotes.js';
