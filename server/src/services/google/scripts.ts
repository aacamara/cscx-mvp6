/**
 * Google Apps Script Service
 * Handles Apps Script deployment and execution for automations
 */

import { google, script_v1 } from 'googleapis';
import { googleOAuth } from './oauth.js';

// Types
export interface AppsScript {
  id: string;
  title: string;
  scriptId: string;
  deploymentId?: string;
  parentId?: string; // Container (Sheet, Doc, etc.)
  type: ScriptType;
  status: 'draft' | 'deployed' | 'error';
  triggers: ScriptTrigger[];
  createdAt?: Date;
  modifiedAt?: Date;
}

export type ScriptType =
  | 'standalone'
  | 'container_bound_sheets'
  | 'container_bound_docs'
  | 'container_bound_slides'
  | 'container_bound_forms';

export interface ScriptTrigger {
  id: string;
  type: TriggerType;
  functionName: string;
  enabled: boolean;
  config?: TriggerConfig;
}

export type TriggerType =
  | 'time_based'
  | 'spreadsheet_open'
  | 'spreadsheet_edit'
  | 'spreadsheet_change'
  | 'form_submit'
  | 'calendar_event'
  | 'document_open';

export interface TriggerConfig {
  // Time-based trigger config
  frequency?: 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  interval?: number; // For minutes (1, 5, 10, 15, 30)
  hour?: number; // For daily triggers (0-23)
  dayOfWeek?: number; // For weekly (0=Sunday, 6=Saturday)
  dayOfMonth?: number; // For monthly (1-31)
  timezone?: string;
}

export interface CreateScriptOptions {
  title: string;
  type?: ScriptType;
  parentId?: string;
  code: string;
  triggers?: Omit<ScriptTrigger, 'id'>[];
}

export interface ScriptExecution {
  id: string;
  scriptId: string;
  functionName: string;
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

// Pre-built automation scripts
export const AUTOMATION_SCRIPTS = {
  healthScoreCalculator: `
/**
 * Health Score Calculator
 * Calculates customer health scores based on multiple signals
 */
function calculateHealthScores() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Health Score');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Find column indices
  const cols = {
    usage: headers.indexOf('Product Usage'),
    engagement: headers.indexOf('Engagement'),
    support: headers.indexOf('Support'),
    nps: headers.indexOf('NPS'),
    contract: headers.indexOf('Contract'),
    stakeholder: headers.indexOf('Stakeholder'),
    overall: headers.indexOf('Overall Score'),
    grade: headers.indexOf('Grade'),
    trend: headers.indexOf('Trend'),
  };

  // Weights for each signal
  const weights = {
    usage: 0.25,
    engagement: 0.20,
    support: 0.15,
    nps: 0.15,
    contract: 0.15,
    stakeholder: 0.10,
  };

  // Calculate scores for each customer
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const score =
      (row[cols.usage] || 0) * weights.usage +
      (row[cols.engagement] || 0) * weights.engagement +
      (row[cols.support] || 0) * weights.support +
      (row[cols.nps] || 0) * weights.nps +
      (row[cols.contract] || 0) * weights.contract +
      (row[cols.stakeholder] || 0) * weights.stakeholder;

    // Update overall score
    sheet.getRange(i + 1, cols.overall + 1).setValue(Math.round(score));

    // Calculate grade
    let grade;
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';
    sheet.getRange(i + 1, cols.grade + 1).setValue(grade);
  }

  // Update last updated timestamp
  const lastUpdated = headers.indexOf('Last Updated');
  if (lastUpdated >= 0) {
    for (let i = 1; i < data.length; i++) {
      sheet.getRange(i + 1, lastUpdated + 1).setValue(new Date());
    }
  }
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('CSCX.AI')
    .addItem('Calculate Health Scores', 'calculateHealthScores')
    .addToUi();
}
`,

  renewalAlerts: `
/**
 * Renewal Alerts
 * Sends alerts for upcoming renewals
 */
function checkRenewalAlerts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Renewals');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {
    customer: headers.indexOf('Customer'),
    renewalDate: headers.indexOf('Renewal Date'),
    daysUntil: headers.indexOf('Days Until Renewal'),
    status: headers.indexOf('Status'),
    owner: headers.indexOf('Owner'),
    arr: headers.indexOf('ARR'),
  };

  const today = new Date();
  const alerts = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const renewalDate = new Date(row[cols.renewalDate]);
    const daysUntil = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));

    // Update days until renewal
    sheet.getRange(i + 1, cols.daysUntil + 1).setValue(daysUntil);

    // Check for alerts (30, 60, 90 day warnings)
    if (daysUntil === 90 || daysUntil === 60 || daysUntil === 30 || daysUntil === 7) {
      alerts.push({
        customer: row[cols.customer],
        daysUntil: daysUntil,
        arr: row[cols.arr],
        owner: row[cols.owner],
      });
    }
  }

  // Send alert email if there are any
  if (alerts.length > 0) {
    const emailBody = alerts.map(a =>
      \`• \${a.customer} - \${a.daysUntil} days until renewal (\$\${a.arr} ARR)\`
    ).join('\\n');

    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: \`[CSCX.AI] \${alerts.length} Upcoming Renewal Alert(s)\`,
      body: \`The following renewals need attention:\\n\\n\${emailBody}\`,
    });
  }
}

function createRenewalTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkRenewalAlerts') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create daily trigger at 9 AM
  ScriptApp.newTrigger('checkRenewalAlerts')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
}
`,

  meetingPrep: `
/**
 * Meeting Prep Automation
 * Generates pre-meeting briefs
 */
function generateMeetingBrief(customerId, meetingTitle) {
  // This would integrate with your CRM/data sources
  const brief = {
    customer: customerId,
    meeting: meetingTitle,
    healthScore: 85,
    recentActivity: [
      'Logged 50 sessions this week',
      'Submitted 2 support tickets',
      'Attended training webinar',
    ],
    openIssues: [
      'Integration performance concern',
    ],
    upcomingMilestones: [
      'Go-live: Feb 15',
      'QBR: Mar 1',
    ],
    talkingPoints: [
      'Review integration performance',
      'Discuss training needs',
      'Plan QBR content',
    ],
  };

  return brief;
}

function onCalendarEvent(e) {
  // Triggered when a calendar event is about to start
  const event = e.calendarEvent;
  const title = event.getTitle();

  // Check if this is a customer meeting
  if (title.includes('[Customer]') || title.includes('QBR') || title.includes('Check-in')) {
    const brief = generateMeetingBrief(title);

    // Create a doc with the brief
    const doc = DocumentApp.create(\`Meeting Brief: \${title}\`);
    const body = doc.getBody();

    body.appendParagraph('Meeting Brief').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(\`Customer: \${brief.customer}\`);
    body.appendParagraph(\`Health Score: \${brief.healthScore}\`);

    body.appendParagraph('Recent Activity').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    brief.recentActivity.forEach(item => body.appendListItem(item));

    body.appendParagraph('Open Issues').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    brief.openIssues.forEach(item => body.appendListItem(item));

    body.appendParagraph('Talking Points').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    brief.talkingPoints.forEach(item => body.appendListItem(item));

    // Email the brief
    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: \`[CSCX.AI] Meeting Brief: \${title}\`,
      body: \`Your meeting brief is ready: \${doc.getUrl()}\`,
    });
  }
}
`,

  weeklyDigest: `
/**
 * Weekly CSM Digest
 * Sends a weekly summary of all customers
 */
function sendWeeklyDigest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Gather data from various sheets
  const healthSheet = ss.getSheetByName('Health Score');
  const renewalSheet = ss.getSheetByName('Renewals');

  const healthData = healthSheet ? healthSheet.getDataRange().getValues() : [];
  const renewalData = renewalSheet ? renewalSheet.getDataRange().getValues() : [];

  // Calculate summary stats
  const totalCustomers = healthData.length - 1;
  const healthScores = healthData.slice(1).map(row => row[1]).filter(s => s);
  const avgHealth = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;

  const atRisk = healthScores.filter(s => s < 70).length;
  const healthy = healthScores.filter(s => s >= 80).length;

  // Upcoming renewals (next 30 days)
  const today = new Date();
  const upcomingRenewals = renewalData.slice(1).filter(row => {
    const renewalDate = new Date(row[2]);
    const daysUntil = (renewalDate - today) / (1000 * 60 * 60 * 24);
    return daysUntil > 0 && daysUntil <= 30;
  });

  // Build email
  const emailBody = \`
Weekly CSM Digest - \${new Date().toLocaleDateString()}

PORTFOLIO SUMMARY
-----------------
Total Customers: \${totalCustomers}
Average Health Score: \${Math.round(avgHealth)}
Healthy Customers (80+): \${healthy}
At-Risk Customers (<70): \${atRisk}

UPCOMING RENEWALS (Next 30 Days)
--------------------------------
\${upcomingRenewals.map(r => \`• \${r[0]} - \${new Date(r[2]).toLocaleDateString()}\`).join('\\n') || 'None'}

ACTION ITEMS
------------
\${atRisk > 0 ? \`• Review \${atRisk} at-risk customers\` : ''}
\${upcomingRenewals.length > 0 ? \`• Follow up on \${upcomingRenewals.length} upcoming renewals\` : ''}

---
Powered by CSCX.AI
\`;

  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: \`[CSCX.AI] Weekly CSM Digest - \${new Date().toLocaleDateString()}\`,
    body: emailBody,
  });
}

function createWeeklyDigestTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendWeeklyDigest') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create weekly trigger on Monday at 8 AM
  ScriptApp.newTrigger('sendWeeklyDigest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();
}
`,

  usageTracker: `
/**
 * Usage Tracker
 * Tracks and analyzes product usage metrics
 */
function updateUsageMetrics() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usage Summary');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {
    customer: headers.indexOf('Customer'),
    dau: headers.indexOf('DAU'),
    wau: headers.indexOf('WAU'),
    mau: headers.indexOf('MAU'),
    trend: headers.indexOf('Trend'),
    period: headers.indexOf('Period'),
  };

  // Calculate trends
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dau = row[cols.dau] || 0;
    const wau = row[cols.wau] || 0;
    const mau = row[cols.mau] || 0;

    // Simple trend calculation based on DAU/MAU ratio
    const ratio = mau > 0 ? (dau / mau) * 30 : 0;
    let trend;
    if (ratio >= 0.5) trend = '📈 Growing';
    else if (ratio >= 0.3) trend = '➡️ Stable';
    else trend = '📉 Declining';

    sheet.getRange(i + 1, cols.trend + 1).setValue(trend);
    sheet.getRange(i + 1, cols.period + 1).setValue(new Date().toLocaleDateString());
  }
}

function checkUsageAlerts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usage Summary');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const cols = {
    customer: headers.indexOf('Customer'),
    trend: headers.indexOf('Trend'),
    dau: headers.indexOf('DAU'),
  };

  const declining = data.slice(1).filter(row =>
    row[cols.trend] && row[cols.trend].includes('Declining')
  );

  if (declining.length > 0) {
    const emailBody = declining.map(row =>
      \`• \${row[cols.customer]} - DAU: \${row[cols.dau]}\`
    ).join('\\n');

    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: \`[CSCX.AI] Usage Alert: \${declining.length} Declining Customer(s)\`,
      body: \`The following customers show declining usage:\\n\\n\${emailBody}\\n\\nConsider proactive outreach.\`,
    });
  }
}
`,

  npsFollowUp: `
/**
 * NPS Follow-up Automation
 * Triggers follow-up actions based on NPS responses
 */
function processNPSResponse(e) {
  // Triggered on form submission
  const response = e.response;
  const items = response.getItemResponses();

  let customer, score, feedback;

  items.forEach(item => {
    const question = item.getItem().getTitle();
    const answer = item.getResponse();

    if (question.toLowerCase().includes('customer') || question.toLowerCase().includes('company')) {
      customer = answer;
    } else if (question.toLowerCase().includes('score') || question.toLowerCase().includes('recommend')) {
      score = parseInt(answer);
    } else if (question.toLowerCase().includes('feedback') || question.toLowerCase().includes('why')) {
      feedback = answer;
    }
  });

  if (!customer || score === undefined) return;

  // Categorize response
  let category, action;
  if (score >= 9) {
    category = 'Promoter';
    action = 'Send thank you, request testimonial/referral';
  } else if (score >= 7) {
    category = 'Passive';
    action = 'Schedule check-in to understand how to improve';
  } else {
    category = 'Detractor';
    action = 'URGENT: Schedule call to address concerns';
  }

  // Log to spreadsheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName('NPS Responses');
  if (!logSheet) {
    logSheet = ss.insertSheet('NPS Responses');
    logSheet.appendRow(['Timestamp', 'Customer', 'Score', 'Category', 'Feedback', 'Action', 'Status']);
  }

  logSheet.appendRow([
    new Date(),
    customer,
    score,
    category,
    feedback || '',
    action,
    'Pending',
  ]);

  // Send alert for detractors
  if (score < 7) {
    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: \`[CSCX.AI] URGENT: Detractor NPS Response from \${customer}\`,
      body: \`
Customer: \${customer}
NPS Score: \${score}
Category: \${category}
Feedback: \${feedback || 'No feedback provided'}

Recommended Action: \${action}

Please follow up within 24 hours.
\`,
    });
  }
}
`,
};

export class ScriptsService {
  /**
   * Get Google Apps Script API client for a user
   */
  private async getScriptClient(userId: string): Promise<script_v1.Script> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    return google.script({ version: 'v1', auth });
  }

  /**
   * Create a new Apps Script project
   */
  async createScript(userId: string, options: CreateScriptOptions): Promise<AppsScript> {
    const script = await this.getScriptClient(userId);

    // Create the project
    const createResponse = await script.projects.create({
      requestBody: {
        title: options.title,
        parentId: options.parentId, // If container-bound
      },
    });

    const scriptId = createResponse.data.scriptId;
    if (!scriptId) {
      throw new Error('Failed to create script project');
    }

    // Update the script content
    await script.projects.updateContent({
      scriptId,
      requestBody: {
        files: [
          {
            name: 'Code',
            type: 'SERVER_JS',
            source: options.code,
          },
          {
            name: 'appsscript',
            type: 'JSON',
            source: JSON.stringify({
              timeZone: 'America/New_York',
              dependencies: {},
              exceptionLogging: 'STACKDRIVER',
              runtimeVersion: 'V8',
            }),
          },
        ],
      },
    });

    return {
      id: scriptId,
      title: options.title,
      scriptId,
      parentId: options.parentId,
      type: options.type || 'standalone',
      status: 'draft',
      triggers: [],
    };
  }

  /**
   * Get script project details
   */
  async getScript(userId: string, scriptId: string): Promise<AppsScript> {
    const script = await this.getScriptClient(userId);

    const response = await script.projects.get({
      scriptId,
    });

    const project = response.data;

    return {
      id: project.scriptId || scriptId,
      title: project.title || 'Untitled',
      scriptId: project.scriptId || scriptId,
      parentId: project.parentId || undefined,
      type: 'standalone',
      status: 'draft',
      triggers: [],
      createdAt: project.createTime ? new Date(project.createTime) : undefined,
      modifiedAt: project.updateTime ? new Date(project.updateTime) : undefined,
    };
  }

  /**
   * Update script content
   */
  async updateScript(userId: string, scriptId: string, code: string): Promise<void> {
    const script = await this.getScriptClient(userId);

    // Get current content to preserve manifest
    const content = await script.projects.getContent({ scriptId });
    const manifestFile = content.data.files?.find(f => f.name === 'appsscript');

    await script.projects.updateContent({
      scriptId,
      requestBody: {
        files: [
          {
            name: 'Code',
            type: 'SERVER_JS',
            source: code,
          },
          manifestFile || {
            name: 'appsscript',
            type: 'JSON',
            source: JSON.stringify({
              timeZone: 'America/New_York',
              dependencies: {},
              exceptionLogging: 'STACKDRIVER',
              runtimeVersion: 'V8',
            }),
          },
        ],
      },
    });
  }

  /**
   * Deploy script as API executable
   */
  async deployScript(
    userId: string,
    scriptId: string,
    description: string = 'CSCX.AI Deployment'
  ): Promise<string> {
    const script = await this.getScriptClient(userId);

    // Create a new version
    const versionResponse = await script.projects.versions.create({
      scriptId,
      requestBody: {
        description,
      },
    });

    const versionNumber = versionResponse.data.versionNumber;

    // Create deployment
    const deployResponse = await script.projects.deployments.create({
      scriptId,
      requestBody: {
        versionNumber,
        description,
        manifestFileName: 'appsscript',
      },
    });

    return deployResponse.data.deploymentId || '';
  }

  /**
   * Execute a script function
   */
  async executeScript(
    userId: string,
    scriptId: string,
    functionName: string,
    parameters?: unknown[]
  ): Promise<ScriptExecution> {
    const script = await this.getScriptClient(userId);

    const executionId = `exec_${Date.now()}`;
    const startedAt = new Date();

    try {
      const response = await script.scripts.run({
        scriptId,
        requestBody: {
          function: functionName,
          parameters: parameters || [],
        },
      });

      if (response.data.error) {
        return {
          id: executionId,
          scriptId,
          functionName,
          status: 'failed',
          error: response.data.error.message || 'Execution failed',
          startedAt,
          completedAt: new Date(),
        };
      }

      return {
        id: executionId,
        scriptId,
        functionName,
        status: 'completed',
        result: response.data.response?.result,
        startedAt,
        completedAt: new Date(),
      };
    } catch (error) {
      return {
        id: executionId,
        scriptId,
        functionName,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        startedAt,
        completedAt: new Date(),
      };
    }
  }

  /**
   * Create a pre-built automation script
   */
  async createAutomation(
    userId: string,
    automationType: keyof typeof AUTOMATION_SCRIPTS,
    title: string,
    parentId?: string
  ): Promise<AppsScript> {
    const code = AUTOMATION_SCRIPTS[automationType];
    if (!code) {
      throw new Error(`Unknown automation type: ${automationType}`);
    }

    return this.createScript(userId, {
      title,
      code,
      parentId,
      type: parentId ? 'container_bound_sheets' : 'standalone',
    });
  }

  /**
   * List available automation templates
   */
  getAutomationTemplates(): { id: string; name: string; description: string }[] {
    return [
      {
        id: 'healthScoreCalculator',
        name: 'Health Score Calculator',
        description: 'Automatically calculates customer health scores based on multiple signals',
      },
      {
        id: 'renewalAlerts',
        name: 'Renewal Alerts',
        description: 'Sends alerts for upcoming renewals at 90, 60, 30, and 7 day marks',
      },
      {
        id: 'meetingPrep',
        name: 'Meeting Prep',
        description: 'Generates pre-meeting briefs with customer context',
      },
      {
        id: 'weeklyDigest',
        name: 'Weekly CSM Digest',
        description: 'Sends weekly portfolio summary every Monday',
      },
      {
        id: 'usageTracker',
        name: 'Usage Tracker',
        description: 'Tracks usage trends and alerts on declining customers',
      },
      {
        id: 'npsFollowUp',
        name: 'NPS Follow-up',
        description: 'Processes NPS responses and triggers appropriate follow-up actions',
      },
    ];
  }

  /**
   * Delete a script project
   */
  async deleteScript(userId: string, scriptId: string): Promise<void> {
    // Note: Apps Script API doesn't support deleting projects directly
    // You would need to use Drive API to trash the file
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });

    await drive.files.delete({
      fileId: scriptId,
    });
  }

  /**
   * List user's script projects
   */
  async listScripts(userId: string): Promise<AppsScript[]> {
    // Apps Script projects are stored in Drive, search for them
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.script'",
      fields: 'files(id, name, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc',
    });

    return (response.data.files || []).map(file => ({
      id: file.id || '',
      title: file.name || 'Untitled',
      scriptId: file.id || '',
      type: 'standalone' as ScriptType,
      status: 'draft' as const,
      triggers: [],
      createdAt: file.createdTime ? new Date(file.createdTime) : undefined,
      modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
    }));
  }
}

// Singleton instance
export const scriptsService = new ScriptsService();
