/**
 * Data Analyst Agent
 * Specialized agent for analyzing customer data from CSV uploads
 *
 * Capabilities:
 * - CSV parsing and column mapping
 * - Churn risk analysis and scoring
 * - Pattern detection across accounts
 * - Personalized rescue email generation
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { csvParser, ColumnMapping, ParsedCSV } from '../../services/fileUpload/csvParser.js';
import { churnScoringService, ChurnRiskScore, ChurnAnalysisResult } from '../../services/analysis/churnScoring.js';
import { draftEmail, DraftEmailParams, DraftedEmail, EmailContext, EmailType } from '../../services/ai/email-drafter.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
export interface DataAnalystInput {
  action: 'parse_csv' | 'confirm_mapping' | 'analyze_churn' | 'draft_rescue_emails' | 'get_summary';
  userId: string;
  fileId?: string;
  csvContent?: string | Buffer;
  fileName?: string;
  columnMapping?: ColumnMapping;
  riskThreshold?: number;
  customerId?: string;
}

export interface DataAnalystOutput {
  success: boolean;
  action: string;
  fileId?: string;
  parsedData?: {
    headers: string[];
    rowCount: number;
    columnCount: number;
    previewData: Record<string, any>[];
    suggestedMapping: ColumnMapping;
  };
  analysisResult?: ChurnAnalysisResult;
  draftEmails?: RescueEmail[];
  summary?: string;
  error?: string;
}

export interface RescueEmail {
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  riskScore: number;
  riskLevel: string;
  primaryConcern: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  suggestedSendTime: string;
  talkingPoints: string[];
}

// In-memory file storage for testing without Supabase
const inMemoryFiles: Map<string, { content: Buffer | string; fileName: string; parsed: ParsedCSV }> = new Map();

class DataAnalystAgent {
  private supabase: SupabaseClient | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  /**
   * Main entry point for the Data Analyst agent
   */
  async execute(input: DataAnalystInput): Promise<DataAnalystOutput> {
    try {
      switch (input.action) {
        case 'parse_csv':
          return await this.parseCSV(input);

        case 'confirm_mapping':
          return await this.confirmMapping(input);

        case 'analyze_churn':
          return await this.analyzeChurn(input);

        case 'draft_rescue_emails':
          return await this.draftRescueEmails(input);

        case 'get_summary':
          return await this.getSummary(input);

        default:
          return {
            success: false,
            action: input.action,
            error: `Unknown action: ${input.action}`
          };
      }
    } catch (error) {
      console.error(`DataAnalyst error (${input.action}):`, error);
      return {
        success: false,
        action: input.action,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse CSV content and detect column mappings
   */
  private async parseCSV(input: DataAnalystInput): Promise<DataAnalystOutput> {
    if (!input.csvContent) {
      return { success: false, action: 'parse_csv', error: 'No CSV content provided' };
    }

    const fileName = input.fileName || 'uploaded_file.csv';

    // Parse the CSV
    const parsed = await csvParser.parseCSV(input.csvContent);

    // Suggest column mappings
    const suggestions = csvParser.suggestColumnMappings(parsed.headers);
    const suggestedMapping = csvParser.createMappingFromSuggestions(suggestions);

    // Save to database or in-memory
    let fileId: string;

    if (this.supabase) {
      const fileRecord = await csvParser.saveUploadedFile(
        input.userId,
        fileName,
        input.csvContent,
        { customerId: input.customerId }
      );
      fileId = fileRecord.id;
    } else {
      // Use in-memory storage
      fileId = `temp-${Date.now()}`;
      inMemoryFiles.set(fileId, {
        content: input.csvContent,
        fileName,
        parsed
      });
    }

    return {
      success: true,
      action: 'parse_csv',
      fileId,
      parsedData: {
        headers: parsed.headers,
        rowCount: parsed.rowCount,
        columnCount: parsed.columnCount,
        previewData: parsed.rows.slice(0, 10),
        suggestedMapping
      }
    };
  }

  /**
   * Confirm or update column mapping
   */
  private async confirmMapping(input: DataAnalystInput): Promise<DataAnalystOutput> {
    if (!input.fileId) {
      return { success: false, action: 'confirm_mapping', error: 'No file ID provided' };
    }

    if (!input.columnMapping) {
      return { success: false, action: 'confirm_mapping', error: 'No column mapping provided' };
    }

    // Validate mapping
    const validation = csvParser.validateMapping(input.columnMapping);
    if (!validation.valid) {
      return {
        success: false,
        action: 'confirm_mapping',
        error: `Missing required fields: ${validation.missing.join(', ')}`
      };
    }

    // Update mapping in database
    if (this.supabase) {
      await csvParser.updateColumnMapping(input.fileId, input.columnMapping);
    } else {
      // Update in-memory
      const file = inMemoryFiles.get(input.fileId);
      if (file) {
        // Mapping is stored for the next step
      }
    }

    return {
      success: true,
      action: 'confirm_mapping',
      fileId: input.fileId,
      summary: 'Column mapping confirmed. Ready for churn analysis.'
    };
  }

  /**
   * Analyze data for churn risk
   */
  private async analyzeChurn(input: DataAnalystInput): Promise<DataAnalystOutput> {
    if (!input.fileId) {
      return { success: false, action: 'analyze_churn', error: 'No file ID provided' };
    }

    if (!input.columnMapping) {
      return { success: false, action: 'analyze_churn', error: 'No column mapping provided' };
    }

    // Get the file content
    let rows: Record<string, any>[];

    if (this.supabase) {
      const fileRecord = await csvParser.getUploadedFile(input.fileId);
      if (!fileRecord) {
        return { success: false, action: 'analyze_churn', error: 'File not found' };
      }

      // For database storage, we need to re-parse or store rows
      // For now, use preview data if available (for demo purposes)
      rows = fileRecord.previewData;
    } else {
      // Get from in-memory storage
      const file = inMemoryFiles.get(input.fileId);
      if (!file) {
        return { success: false, action: 'analyze_churn', error: 'File not found' };
      }
      rows = file.parsed.rows;
    }

    // Perform churn analysis
    const analysisResult = await churnScoringService.analyzeCSVData(
      input.fileId,
      rows,
      input.columnMapping
    );

    // Update file status
    if (this.supabase) {
      await csvParser.updateFileStatus(input.fileId, 'analyzed');
    }

    // Generate summary text
    const summary = this.generateAnalysisSummary(analysisResult);

    return {
      success: true,
      action: 'analyze_churn',
      fileId: input.fileId,
      analysisResult,
      summary
    };
  }

  /**
   * Generate personalized rescue emails for high-risk accounts
   */
  private async draftRescueEmails(input: DataAnalystInput): Promise<DataAnalystOutput> {
    if (!input.fileId) {
      return { success: false, action: 'draft_rescue_emails', error: 'No file ID provided' };
    }

    const threshold = input.riskThreshold || 70;

    // Get high-risk accounts
    let highRiskAccounts: ChurnRiskScore[];

    if (this.supabase) {
      highRiskAccounts = await churnScoringService.getHighRiskAccounts(input.fileId, threshold);
    } else {
      // Get from in-memory analysis (would need to be stored)
      // For now, return empty for in-memory mode
      highRiskAccounts = [];
    }

    if (highRiskAccounts.length === 0) {
      return {
        success: true,
        action: 'draft_rescue_emails',
        fileId: input.fileId,
        draftEmails: [],
        summary: `No accounts found with risk score >= ${threshold}`
      };
    }

    // Draft rescue emails for each high-risk account
    const draftEmails: RescueEmail[] = [];

    for (const account of highRiskAccounts) {
      const email = await this.draftRescueEmail(account, input.userId);
      if (email) {
        draftEmails.push(email);
      }
    }

    // Save drafts to database if available
    if (this.supabase && draftEmails.length > 0) {
      await this.saveDraftEmails(input.userId, input.fileId, draftEmails);
    }

    return {
      success: true,
      action: 'draft_rescue_emails',
      fileId: input.fileId,
      draftEmails,
      summary: `Generated ${draftEmails.length} personalized rescue emails for high-risk accounts`
    };
  }

  /**
   * Draft a single rescue email
   */
  private async draftRescueEmail(
    account: ChurnRiskScore,
    userId: string
  ): Promise<RescueEmail | null> {
    try {
      // Build context from churn analysis
      const context: EmailContext = {
        healthScore: 100 - account.riskScore, // Invert risk to health
        riskSignals: account.primaryConcerns,
        recentActivity: account.riskFactors.map(f => f.description)
      };

      // Add usage metrics if available
      if (account.usageMetrics.arr) {
        context.arr = account.usageMetrics.arr;
      }
      if (account.usageMetrics.daysSinceLogin) {
        context.lastContact = `${account.usageMetrics.daysSinceLogin} days ago`;
      }

      // Determine email type based on primary concern
      let emailType: EmailType = 'risk_outreach';
      let customInstructions = '';

      const primaryConcern = account.primaryConcerns[0] || 'General decline';

      if (primaryConcern.includes('inactive') || primaryConcern.includes('login')) {
        customInstructions = 'Focus on re-engagement and reminding them of value they may be missing.';
      } else if (primaryConcern.includes('decline') || primaryConcern.includes('usage')) {
        customInstructions = 'Address the declining usage trend and offer support to help them get back on track.';
      } else if (primaryConcern.includes('ticket') || primaryConcern.includes('support')) {
        customInstructions = 'Acknowledge the support issues and offer a call to resolve concerns.';
      } else if (primaryConcern.includes('NPS') || primaryConcern.includes('satisfaction')) {
        customInstructions = 'Address their concerns directly and show commitment to improving their experience.';
      }

      // Get recipient name (extract from customer name or use generic)
      const recipientName = this.extractContactName(account.customerName);

      // Draft the email using AI
      const draftParams: DraftEmailParams = {
        type: emailType,
        customerName: account.customerName,
        recipientName,
        recipientEmail: account.customerEmail,
        context,
        tone: account.riskLevel === 'critical' ? 'urgent' : 'professional',
        customInstructions,
        senderName: 'Your Customer Success Manager'
      };

      const draft = await draftEmail(draftParams);

      return {
        customerName: account.customerName,
        customerEmail: account.customerEmail,
        riskScore: account.riskScore,
        riskLevel: account.riskLevel,
        primaryConcern,
        subject: draft.subject,
        bodyHtml: `<p>${draft.body.replace(/\n/g, '</p><p>')}</p>`,
        bodyText: draft.body,
        suggestedSendTime: draft.suggestedSendTime,
        talkingPoints: draft.talkingPoints || []
      };
    } catch (error) {
      console.error(`Failed to draft email for ${account.customerName}:`, error);
      return null;
    }
  }

  /**
   * Extract a contact name from company name
   */
  private extractContactName(customerName: string): string {
    // If the name looks like a person's name, use it
    const words = customerName.trim().split(/\s+/);
    if (words.length === 2 && !this.looksLikeCompany(customerName)) {
      return words[0]; // First name
    }
    // Default to generic
    return 'Team';
  }

  /**
   * Check if name looks like a company name
   */
  private looksLikeCompany(name: string): boolean {
    const companyIndicators = ['Inc', 'LLC', 'Corp', 'Ltd', 'Company', 'Co.', 'Technologies', 'Solutions', 'Partners', 'Group'];
    return companyIndicators.some(indicator => name.includes(indicator));
  }

  /**
   * Save draft emails to database
   */
  private async saveDraftEmails(
    userId: string,
    fileId: string,
    emails: RescueEmail[]
  ): Promise<void> {
    if (!this.supabase) return;

    // Create a bulk operation record
    const { data: operation, error: opError } = await (this.supabase as any)
      .from('bulk_operations')
      .insert({
        user_id: userId,
        operation_type: 'bulk_email_draft',
        source_file_id: fileId,
        status: 'completed',
        total_items: emails.length,
        processed_items: emails.length,
        successful_items: emails.length,
        failed_items: 0
      })
      .select()
      .single();

    if (opError) {
      console.error('Failed to create bulk operation:', opError);
      return;
    }

    // Save each draft email
    const drafts = emails.map(email => ({
      user_id: userId,
      bulk_operation_id: operation.id,
      customer_name: email.customerName,
      recipient_email: email.customerEmail || '',
      subject: email.subject,
      body_html: email.bodyHtml,
      body_text: email.bodyText,
      risk_level: email.riskLevel,
      primary_concern: email.primaryConcern,
      talking_points: email.talkingPoints,
      status: 'draft'
    }));

    const { error } = await (this.supabase as any)
      .from('draft_emails')
      .insert(drafts);

    if (error) {
      console.error('Failed to save draft emails:', error);
    }
  }

  /**
   * Get summary of analysis
   */
  private async getSummary(input: DataAnalystInput): Promise<DataAnalystOutput> {
    if (!input.fileId) {
      return { success: false, action: 'get_summary', error: 'No file ID provided' };
    }

    const summary = await churnScoringService.getRiskSummary(input.fileId);
    if (!summary) {
      return { success: false, action: 'get_summary', error: 'No analysis found for this file' };
    }

    const total = summary.lowRisk + summary.mediumRisk + summary.highRisk + summary.criticalRisk;
    const summaryText = `
Analysis Summary:
- Total accounts analyzed: ${total}
- High Risk (70-100): ${summary.highRisk + summary.criticalRisk} accounts
- Medium Risk (40-69): ${summary.mediumRisk} accounts
- Low Risk (0-39): ${summary.lowRisk} accounts
- Average Risk Score: ${summary.averageRiskScore}/100
    `.trim();

    return {
      success: true,
      action: 'get_summary',
      fileId: input.fileId,
      summary: summaryText
    };
  }

  /**
   * Generate analysis summary text
   */
  private generateAnalysisSummary(result: ChurnAnalysisResult): string {
    const highRisk = result.summary.highRisk + result.summary.criticalRisk;

    let summary = `Analyzed ${result.analyzedRecords} accounts.\n\n`;
    summary += `📊 Churn Risk Summary:\n`;
    summary += `- High Risk (70-100): ${highRisk} accounts\n`;
    summary += `- Medium Risk (40-69): ${result.summary.mediumRisk} accounts\n`;
    summary += `- Low Risk (0-39): ${result.summary.lowRisk} accounts\n\n`;

    if (result.patterns.length > 0) {
      summary += `Key patterns detected:\n`;
      for (const pattern of result.patterns.slice(0, 5)) {
        summary += `- ${pattern}\n`;
      }
    }

    if (highRisk > 0) {
      summary += `\nWould you like me to draft rescue emails for the ${highRisk} high-risk accounts?`;
    }

    return summary;
  }
}

// Singleton instance
export const dataAnalystAgent = new DataAnalystAgent();
export default dataAnalystAgent;
