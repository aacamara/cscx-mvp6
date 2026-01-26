/**
 * Google Sheets Service
 * Handles Google Sheets API operations: create, read, update, formulas, charts
 */

import { google, sheets_v4 } from 'googleapis';
import { googleOAuth } from './oauth.js';
import { driveService } from './drive.js';
import { config } from '../../config/index.js';

// Types
export interface GoogleSheet {
  id: string;
  title: string;
  sheets: SheetTab[];
  webViewLink?: string;
  createdAt?: Date;
  modifiedAt?: Date;
}

export interface SheetTab {
  id: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

export interface SheetData {
  range: string;
  values: (string | number | boolean | null)[][];
}

export interface CreateSheetOptions {
  title: string;
  folderId?: string;
  sheets?: string[]; // Sheet tab names
  headers?: string[][]; // Headers for each sheet
  template?: SheetTemplate;
}

export interface SheetTemplate {
  type: 'health_score' | 'renewal_tracker' | 'onboarding_tracker' | 'usage_metrics' |
        'customer_scorecard' | 'qbr_metrics' | 'risk_dashboard' | 'adoption_tracker';
  variables?: Record<string, string>;
}

export interface UpdateSheetOptions {
  range: string;
  values: (string | number | boolean | null)[][];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}

export interface AppendRowOptions {
  sheetName: string;
  values: (string | number | boolean | null)[];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}

// Sheet templates with structure
const SHEET_TEMPLATES: Record<string, { sheets: { name: string; headers: string[] }[] }> = {
  health_score: {
    sheets: [
      {
        name: 'Health Score',
        headers: ['Customer', 'Overall Score', 'Grade', 'Trend', 'Product Usage', 'Engagement', 'Support', 'NPS', 'Contract', 'Stakeholder', 'Last Updated'],
      },
      {
        name: 'Score History',
        headers: ['Date', 'Customer', 'Score', 'Grade', 'Change', 'Notes'],
      },
      {
        name: 'Signals',
        headers: ['Customer', 'Signal Type', 'Value', 'Weight', 'Impact', 'Date'],
      },
    ],
  },
  renewal_tracker: {
    sheets: [
      {
        name: 'Renewals',
        headers: ['Customer', 'ARR', 'Renewal Date', 'Days Until Renewal', 'Status', 'Probability', 'Owner', 'Last Contact', 'Risk Factors', 'Notes'],
      },
      {
        name: 'Pipeline',
        headers: ['Customer', 'Stage', 'Expected Close', 'Amount', 'Expansion Opportunity', 'Status'],
      },
      {
        name: 'History',
        headers: ['Customer', 'Previous ARR', 'New ARR', 'Change %', 'Renewal Date', 'Outcome', 'Notes'],
      },
    ],
  },
  onboarding_tracker: {
    sheets: [
      {
        name: 'Onboarding',
        headers: ['Customer', 'Start Date', 'Target Go-Live', 'Current Phase', 'Progress %', 'Health', 'Owner', 'Blockers', 'Next Milestone'],
      },
      {
        name: 'Milestones',
        headers: ['Customer', 'Milestone', 'Due Date', 'Status', 'Completed Date', 'Notes'],
      },
      {
        name: 'Tasks',
        headers: ['Customer', 'Task', 'Owner', 'Due Date', 'Priority', 'Status', 'Dependencies'],
      },
    ],
  },
  usage_metrics: {
    sheets: [
      {
        name: 'Usage Summary',
        headers: ['Customer', 'DAU', 'WAU', 'MAU', 'Sessions', 'Avg Session Duration', 'Feature Adoption', 'Trend', 'Period'],
      },
      {
        name: 'Feature Usage',
        headers: ['Customer', 'Feature', 'Users', 'Sessions', 'Adoption %', 'Trend', 'Period'],
      },
      {
        name: 'Daily Metrics',
        headers: ['Date', 'Customer', 'Active Users', 'Sessions', 'Actions', 'Errors', 'Notes'],
      },
    ],
  },
  customer_scorecard: {
    sheets: [
      {
        name: 'Scorecard',
        headers: ['Customer', 'ARR', 'Health Score', 'NPS', 'Product Usage', 'Engagement', 'Support Tickets', 'Renewal Date', 'CSM', 'Tier'],
      },
      {
        name: 'KPIs',
        headers: ['Customer', 'KPI', 'Target', 'Actual', 'Status', 'Period', 'Notes'],
      },
      {
        name: 'Trends',
        headers: ['Customer', 'Metric', 'Value', 'Previous', 'Change %', 'Period'],
      },
    ],
  },
  qbr_metrics: {
    sheets: [
      {
        name: 'QBR Summary',
        headers: ['Customer', 'Quarter', 'Year', 'Health Score', 'NPS', 'ARR', 'Expansion', 'Key Wins', 'Challenges', 'Next Quarter Goals'],
      },
      {
        name: 'Performance',
        headers: ['Customer', 'Metric', 'Q1', 'Q2', 'Q3', 'Q4', 'YoY Change'],
      },
      {
        name: 'Action Items',
        headers: ['Customer', 'Action', 'Owner', 'Due Date', 'Status', 'Quarter', 'Notes'],
      },
    ],
  },
  risk_dashboard: {
    sheets: [
      {
        name: 'Risk Summary',
        headers: ['Customer', 'Risk Score', 'Risk Level', 'Primary Risk', 'Days at Risk', 'Owner', 'Save Play Status', 'Last Action'],
      },
      {
        name: 'Risk Factors',
        headers: ['Customer', 'Risk Factor', 'Severity', 'Impact', 'Mitigation', 'Status', 'Date Identified'],
      },
      {
        name: 'Interventions',
        headers: ['Customer', 'Intervention', 'Type', 'Start Date', 'End Date', 'Outcome', 'Notes'],
      },
    ],
  },
  adoption_tracker: {
    sheets: [
      {
        name: 'Adoption Overview',
        headers: ['Customer', 'Overall Adoption %', 'Active Users', 'Licensed Users', 'Key Features Adopted', 'Trend', 'Last Updated'],
      },
      {
        name: 'Feature Adoption',
        headers: ['Customer', 'Feature', 'Target %', 'Current %', 'Users', 'Status', 'Campaign'],
      },
      {
        name: 'Training',
        headers: ['Customer', 'Training', 'Attendees', 'Completion %', 'Satisfaction', 'Date', 'Follow-up'],
      },
    ],
  },
};

export class SheetsService {
  /**
   * Get Google Sheets API client for a user
   */
  private async getSheetsClient(userId: string): Promise<sheets_v4.Sheets> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    return google.sheets({ version: 'v4', auth });
  }

  /**
   * Create a new Google Sheet
   */
  async createSpreadsheet(userId: string, options: CreateSheetOptions): Promise<GoogleSheet> {
    const sheets = await this.getSheetsClient(userId);

    // Prepare sheet tabs
    let sheetRequests: sheets_v4.Schema$Sheet[] = [];

    if (options.template) {
      const template = SHEET_TEMPLATES[options.template.type];
      if (template) {
        sheetRequests = template.sheets.map((sheet, index) => ({
          properties: {
            title: sheet.name,
            index,
          },
        }));
      }
    } else if (options.sheets && options.sheets.length > 0) {
      sheetRequests = options.sheets.map((name, index) => ({
        properties: {
          title: name,
          index,
        },
      }));
    }

    // Create spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: options.title,
        },
        sheets: sheetRequests.length > 0 ? sheetRequests : undefined,
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error('Failed to create spreadsheet');
    }

    // Move to specified folder or default CSCX folder
    const targetFolderId = options.folderId || config.google.defaultFolderId;
    if (targetFolderId) {
      await driveService.moveFile(userId, spreadsheetId, targetFolderId);
    }

    // Add headers if using template
    if (options.template) {
      const template = SHEET_TEMPLATES[options.template.type];
      if (template) {
        for (const sheet of template.sheets) {
          await this.updateValues(userId, spreadsheetId, {
            range: `'${sheet.name}'!A1`,
            values: [sheet.headers],
            valueInputOption: 'RAW',
          });

          // Bold the header row
          await this.formatHeaderRow(userId, spreadsheetId, sheet.name);
        }
      }
    } else if (options.headers) {
      const sheetNames = options.sheets || ['Sheet1'];
      for (let i = 0; i < options.headers.length; i++) {
        const sheetName = sheetNames[i] || `Sheet${i + 1}`;
        await this.updateValues(userId, spreadsheetId, {
          range: `'${sheetName}'!A1`,
          values: [options.headers[i]],
          valueInputOption: 'RAW',
        });
        await this.formatHeaderRow(userId, spreadsheetId, sheetName);
      }
    }

    return this.getSpreadsheet(userId, spreadsheetId);
  }

  /**
   * Get a spreadsheet by ID
   */
  async getSpreadsheet(userId: string, spreadsheetId: string): Promise<GoogleSheet> {
    const sheets = await this.getSheetsClient(userId);

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const spreadsheet = response.data;

    // Get file metadata from Drive
    const fileInfo = await driveService.getFile(userId, spreadsheetId);

    return {
      id: spreadsheet.spreadsheetId || spreadsheetId,
      title: spreadsheet.properties?.title || 'Untitled',
      sheets: (spreadsheet.sheets || []).map(sheet => ({
        id: sheet.properties?.sheetId || 0,
        title: sheet.properties?.title || 'Sheet',
        index: sheet.properties?.index || 0,
        rowCount: sheet.properties?.gridProperties?.rowCount || 1000,
        columnCount: sheet.properties?.gridProperties?.columnCount || 26,
      })),
      webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      createdAt: fileInfo.createdTime,
      modifiedAt: fileInfo.modifiedTime,
    };
  }

  /**
   * Get values from a range
   */
  async getValues(userId: string, spreadsheetId: string, range: string): Promise<SheetData> {
    const sheets = await this.getSheetsClient(userId);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return {
      range: response.data.range || range,
      values: response.data.values || [],
    };
  }

  /**
   * Update values in a range
   */
  async updateValues(userId: string, spreadsheetId: string, options: UpdateSheetOptions): Promise<void> {
    const sheets = await this.getSheetsClient(userId);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: options.range,
      valueInputOption: options.valueInputOption || 'USER_ENTERED',
      requestBody: {
        values: options.values,
      },
    });
  }

  /**
   * Append a row to a sheet
   */
  async appendRow(userId: string, spreadsheetId: string, options: AppendRowOptions): Promise<void> {
    const sheets = await this.getSheetsClient(userId);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${options.sheetName}'!A:A`,
      valueInputOption: options.valueInputOption || 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [options.values],
      },
    });
  }

  /**
   * Append multiple rows to a sheet
   */
  async appendRows(
    userId: string,
    spreadsheetId: string,
    sheetName: string,
    rows: (string | number | boolean | null)[][]
  ): Promise<void> {
    const sheets = await this.getSheetsClient(userId);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetName}'!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: rows,
      },
    });
  }

  /**
   * Clear a range
   */
  async clearRange(userId: string, spreadsheetId: string, range: string): Promise<void> {
    const sheets = await this.getSheetsClient(userId);

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });
  }

  /**
   * Add a new sheet tab
   */
  async addSheet(userId: string, spreadsheetId: string, title: string): Promise<SheetTab> {
    const sheets = await this.getSheetsClient(userId);

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title,
            },
          },
        }],
      },
    });

    const newSheet = response.data.replies?.[0]?.addSheet?.properties;

    return {
      id: newSheet?.sheetId || 0,
      title: newSheet?.title || title,
      index: newSheet?.index || 0,
      rowCount: newSheet?.gridProperties?.rowCount || 1000,
      columnCount: newSheet?.gridProperties?.columnCount || 26,
    };
  }

  /**
   * Delete a sheet tab
   */
  async deleteSheet(userId: string, spreadsheetId: string, sheetId: number): Promise<void> {
    const sheets = await this.getSheetsClient(userId);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteSheet: {
            sheetId,
          },
        }],
      },
    });
  }

  /**
   * Format header row (bold, freeze)
   */
  async formatHeaderRow(userId: string, spreadsheetId: string, sheetName: string): Promise<void> {
    const sheets = await this.getSheetsClient(userId);

    // First get the sheet ID
    const spreadsheet = await this.getSpreadsheet(userId, spreadsheetId);
    const sheet = spreadsheet.sheets.find(s => s.title === sheetName);
    if (!sheet) return;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Bold the header row
          {
            repeatCell: {
              range: {
                sheetId: sheet.id,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true,
                  },
                  backgroundColor: {
                    red: 0.9,
                    green: 0.9,
                    blue: 0.9,
                  },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
          // Freeze the header row
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheet.id,
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      },
    });
  }

  /**
   * Add conditional formatting
   */
  async addConditionalFormatting(
    userId: string,
    spreadsheetId: string,
    sheetId: number,
    range: { startRow: number; endRow: number; startCol: number; endCol: number },
    rules: Array<{
      condition: 'NUMBER_GREATER' | 'NUMBER_LESS' | 'TEXT_CONTAINS' | 'TEXT_EQ';
      value: string | number;
      backgroundColor: { red: number; green: number; blue: number };
    }>
  ): Promise<void> {
    const sheets = await this.getSheetsClient(userId);

    const requests = rules.map(rule => ({
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId,
            startRowIndex: range.startRow,
            endRowIndex: range.endRow,
            startColumnIndex: range.startCol,
            endColumnIndex: range.endCol,
          }],
          booleanRule: {
            condition: {
              type: rule.condition,
              values: [{ userEnteredValue: String(rule.value) }],
            },
            format: {
              backgroundColor: rule.backgroundColor,
            },
          },
        },
        index: 0,
      },
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

  /**
   * Create a chart
   */
  async createChart(
    userId: string,
    spreadsheetId: string,
    sheetId: number,
    options: {
      title: string;
      type: 'LINE' | 'BAR' | 'PIE' | 'AREA' | 'COLUMN';
      dataRange: string;
      position?: { row: number; col: number };
    }
  ): Promise<void> {
    const sheets = await this.getSheetsClient(userId);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addChart: {
            chart: {
              spec: {
                title: options.title,
                basicChart: {
                  chartType: options.type,
                  domains: [{
                    domain: {
                      sourceRange: {
                        sources: [{
                          sheetId,
                          startRowIndex: 0,
                          endRowIndex: 100,
                          startColumnIndex: 0,
                          endColumnIndex: 1,
                        }],
                      },
                    },
                  }],
                  series: [{
                    series: {
                      sourceRange: {
                        sources: [{
                          sheetId,
                          startRowIndex: 0,
                          endRowIndex: 100,
                          startColumnIndex: 1,
                          endColumnIndex: 2,
                        }],
                      },
                    },
                  }],
                },
              },
              position: {
                overlayPosition: {
                  anchorCell: {
                    sheetId,
                    rowIndex: options.position?.row || 0,
                    columnIndex: options.position?.col || 3,
                  },
                },
              },
            },
          },
        }],
      },
    });
  }

  /**
   * Create spreadsheet from template
   */
  async createFromTemplate(
    userId: string,
    templateType: SheetTemplate['type'],
    title: string,
    folderId?: string
  ): Promise<GoogleSheet> {
    return this.createSpreadsheet(userId, {
      title,
      folderId,
      template: { type: templateType },
    });
  }

  /**
   * Copy spreadsheet
   */
  async copySpreadsheet(userId: string, spreadsheetId: string, newTitle: string, folderId?: string): Promise<GoogleSheet> {
    const newFileId = await driveService.copyFile(userId, spreadsheetId, newTitle, folderId);
    return this.getSpreadsheet(userId, newFileId);
  }

  /**
   * Share spreadsheet
   */
  async shareSpreadsheet(
    userId: string,
    spreadsheetId: string,
    email: string,
    role: 'reader' | 'writer' | 'commenter' = 'reader'
  ): Promise<void> {
    await driveService.shareFile(userId, spreadsheetId, email, role);
  }

  /**
   * Export as Excel
   */
  async exportAsExcel(userId: string, spreadsheetId: string): Promise<Buffer> {
    return driveService.exportFile(
      userId,
      spreadsheetId,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }

  /**
   * Export as PDF
   */
  async exportAsPdf(userId: string, spreadsheetId: string): Promise<Buffer> {
    return driveService.exportFile(userId, spreadsheetId, 'application/pdf');
  }

  /**
   * Find rows matching criteria
   */
  async findRows(
    userId: string,
    spreadsheetId: string,
    sheetName: string,
    searchColumn: number,
    searchValue: string
  ): Promise<{ rowIndex: number; values: (string | number | boolean | null)[] }[]> {
    const data = await this.getValues(userId, spreadsheetId, `'${sheetName}'!A:Z`);
    const results: { rowIndex: number; values: (string | number | boolean | null)[] }[] = [];

    for (let i = 0; i < data.values.length; i++) {
      const row = data.values[i];
      if (row[searchColumn] && String(row[searchColumn]).toLowerCase().includes(searchValue.toLowerCase())) {
        results.push({ rowIndex: i, values: row });
      }
    }

    return results;
  }

  /**
   * Update specific row
   */
  async updateRow(
    userId: string,
    spreadsheetId: string,
    sheetName: string,
    rowIndex: number,
    values: (string | number | boolean | null)[]
  ): Promise<void> {
    await this.updateValues(userId, spreadsheetId, {
      range: `'${sheetName}'!A${rowIndex + 1}`,
      values: [values],
    });
  }

  /**
   * Delete row
   */
  async deleteRow(userId: string, spreadsheetId: string, sheetId: number, rowIndex: number): Promise<void> {
    const sheets = await this.getSheetsClient(userId);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        }],
      },
    });
  }
}

// Singleton instance
export const sheetsService = new SheetsService();
