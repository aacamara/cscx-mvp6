/**
 * MCP Tools Index
 * Exports all MCP tool wrappers
 */

// Google Tools
export { gmailTools, gmailListThreads, gmailGetThread, gmailSendEmail, gmailCreateDraft, gmailSearch, gmailMarkAsRead, gmailArchiveThread, gmailStarThread, gmailGetLabels } from './gmail.js';
export { calendarTools, calendarListEvents, calendarGetEvent, calendarCreateEvent, calendarUpdateEvent, calendarCheckAvailability, calendarDeleteEvent, calendarGetUpcoming, calendarGetToday } from './calendar.js';
export { driveTools, driveListFiles, driveGetFile, driveCreateFolder, driveUploadFile, driveShareFile, driveDeleteFile, driveCopyFile, driveMoveFile, driveSearch, driveGetCustomerFolder } from './drive.js';

// Slack Tools
export { slackTools, slackSendMessage, slackListChannels, slackGetChannel, slackGetUser, slackFindUserByEmail, slackSendDM, slackReplyToThread, slackAddReaction, slackListUsers, slackCheckConnection } from './slack.js';

// Aggregate all tools
import { gmailTools } from './gmail.js';
import { calendarTools } from './calendar.js';
import { driveTools } from './drive.js';
import { slackTools } from './slack.js';
import { MCPTool } from '../index.js';

export const googleTools: MCPTool[] = [
  ...gmailTools,
  ...calendarTools,
  ...driveTools,
];

// All tools combined
export const allTools: MCPTool[] = [
  ...googleTools,
  ...slackTools,
];

// Tool counts by category
export function getToolStats() {
  return {
    total: allTools.length,
    google: googleTools.length,
    gmail: gmailTools.length,
    calendar: calendarTools.length,
    drive: driveTools.length,
    slack: slackTools.length,
  };
}
