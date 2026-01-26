/**
 * Google Services Index
 * Exports all Google Workspace service modules
 */

// OAuth
export { GoogleOAuthService, googleOAuth, GOOGLE_SCOPES } from './oauth.js';
export type { GoogleTokens, GoogleUserInfo } from './oauth.js';

// Gmail
export { GmailService, gmailService } from './gmail.js';
export type { EmailThread, EmailMessage, DraftEmail, SendEmailOptions } from './gmail.js';

// Calendar
export { CalendarService, calendarService } from './calendar.js';
export type { CalendarEvent, EventAttendee, CreateEventOptions, UpdateEventOptions, FreeBusySlot } from './calendar.js';

// Drive
export { DriveService, driveService, GOOGLE_MIME_TYPES } from './drive.js';
export type { DriveFile, DriveFolder, FileContent, SearchOptions } from './drive.js';

// Docs
export { DocsService, docsService } from './docs.js';
export type { GoogleDoc, DocSection, DocTemplate, CreateDocOptions, UpdateDocOptions } from './docs.js';

// Sheets
export { SheetsService, sheetsService } from './sheets.js';
export type { GoogleSheet, SheetTab, SheetData, SheetTemplate, CreateSheetOptions, UpdateSheetOptions, AppendRowOptions } from './sheets.js';

// Slides
export { SlidesService, slidesService } from './slides.js';
export type { GooglePresentation, SlideInfo, SlideTemplate, CreatePresentationOptions, SlideContent } from './slides.js';

// Apps Script
export { ScriptsService, scriptsService, AUTOMATION_SCRIPTS } from './scripts.js';
export type { AppsScript, ScriptType, ScriptTrigger, TriggerType, TriggerConfig, CreateScriptOptions, ScriptExecution } from './scripts.js';

// HITL Approval
export { GoogleApprovalService, googleApprovalService } from './approval.js';
export type { GoogleActionType, ApprovalPolicy, ApprovalRule, PendingApproval, ApprovalResult } from './approval.js';

// Customer Workspace
export { CustomerWorkspaceService, customerWorkspaceService } from './workspace.js';
export type { CustomerWorkspace, WorkspaceFolders, WorkspaceTemplates, WorkspaceAutomations, WorkspaceSettings, CreateWorkspaceOptions } from './workspace.js';

// Agent Actions (Unified Interface)
export * from './agentActions.js';
