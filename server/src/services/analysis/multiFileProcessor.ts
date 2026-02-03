/**
 * Multi-File Processor Service
 * PRD-021: Multi-File Upload Cross-Reference Analysis
 *
 * Handles batch file uploads, identifies file types, extracts data,
 * and normalizes to a common format for cross-reference analysis.
 */

import { v4 as uuidv4 } from 'uuid';
import { ClaudeService } from '../claude.js';
import { GeminiService } from '../gemini.js';
import { config } from '../../config/index.js';

// ============================================
// TYPES
// ============================================

export type FileType =
  | 'usage_data'
  | 'support_tickets'
  | 'nps_survey'
  | 'meeting_notes'
  | 'invoices'
  | 'contracts'
  | 'emails'
  | 'unknown';

export type FileFormat = 'csv' | 'xlsx' | 'pdf' | 'txt' | 'docx' | 'json';

export interface UploadedFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  format: FileFormat;
  detectedType: FileType;
  content: string;
  uploadedAt: string;
}

export interface ExtractedEvent {
  id: string;
  date: string;
  source: string;
  type: string;
  title: string;
  description: string;
  severity: 'positive' | 'neutral' | 'warning' | 'critical';
  metrics?: Record<string, string | number>;
  confidence: number;
}

export interface FileProcessingResult {
  fileId: string;
  fileName: string;
  type: FileType;
  recordCount: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  keyMetrics: Record<string, string | number>;
  extractedEvents: ExtractedEvent[];
  processingDuration: number;
  errors: string[];
  warnings: string[];
}

export interface ProcessingSession {
  sessionId: string;
  customerId: string;
  customerName: string;
  files: UploadedFile[];
  results: FileProcessingResult[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt: string | null;
}

// ============================================
// MULTI-FILE PROCESSOR SERVICE
// ============================================

export class MultiFileProcessor {
  private claude: ClaudeService;
  private gemini: GeminiService;
  private sessions: Map<string, ProcessingSession> = new Map();

  constructor() {
    this.claude = new ClaudeService();
    this.gemini = new GeminiService();
  }

  /**
   * Process multiple uploaded files
   */
  async processFiles(
    customerId: string,
    customerName: string,
    files: Array<{
      fileName: string;
      mimeType: string;
      content: string;
    }>
  ): Promise<ProcessingSession> {
    const sessionId = uuidv4();
    const uploadedFiles: UploadedFile[] = [];

    // Create uploaded file records
    for (const file of files) {
      const format = this.detectFormat(file.mimeType, file.fileName);
      const type = await this.detectFileType(file.fileName, file.content, format);

      uploadedFiles.push({
        id: uuidv4(),
        fileName: file.fileName,
        mimeType: file.mimeType,
        size: Buffer.from(file.content, 'base64').length,
        format,
        detectedType: type,
        content: file.content,
        uploadedAt: new Date().toISOString()
      });
    }

    // Create session
    const session: ProcessingSession = {
      sessionId,
      customerId,
      customerName,
      files: uploadedFiles,
      results: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    this.sessions.set(sessionId, session);

    // Process all files
    session.status = 'processing';
    const results = await Promise.all(
      uploadedFiles.map(file => this.processFile(file, customerName))
    );

    session.results = results;
    session.status = 'completed';
    session.completedAt = new Date().toISOString();

    return session;
  }

  /**
   * Process a single file
   */
  private async processFile(
    file: UploadedFile,
    customerName: string
  ): Promise<FileProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      let extractedData: any;
      let extractedEvents: ExtractedEvent[] = [];

      // Extract content based on format
      const textContent = await this.extractTextContent(file);

      // Use AI to parse and extract structured data
      extractedData = await this.extractStructuredData(
        textContent,
        file.detectedType,
        file.fileName,
        customerName
      );

      // Convert to events
      extractedEvents = this.convertToEvents(extractedData, file.detectedType);

      // Calculate key metrics
      const keyMetrics = this.calculateKeyMetrics(extractedData, file.detectedType);

      // Determine date range
      const dates = extractedEvents
        .map(e => e.date)
        .filter(d => d)
        .sort();

      return {
        fileId: file.id,
        fileName: file.fileName,
        type: file.detectedType,
        recordCount: extractedEvents.length,
        dateRange: {
          start: dates[0] || null,
          end: dates[dates.length - 1] || null
        },
        keyMetrics,
        extractedEvents,
        processingDuration: Date.now() - startTime,
        errors,
        warnings
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Processing failed');
      return {
        fileId: file.id,
        fileName: file.fileName,
        type: file.detectedType,
        recordCount: 0,
        dateRange: { start: null, end: null },
        keyMetrics: {},
        extractedEvents: [],
        processingDuration: Date.now() - startTime,
        errors,
        warnings
      };
    }
  }

  /**
   * Detect file format from MIME type and extension
   */
  private detectFormat(mimeType: string, fileName: string): FileFormat {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (mimeType === 'text/csv' || extension === 'csv') return 'csv';
    if (mimeType.includes('spreadsheet') || extension === 'xlsx' || extension === 'xls') return 'xlsx';
    if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
    if (mimeType === 'application/json' || extension === 'json') return 'json';
    if (mimeType.includes('word') || extension === 'docx' || extension === 'doc') return 'docx';
    if (mimeType.startsWith('text/') || extension === 'txt') return 'txt';

    return 'txt';
  }

  /**
   * Detect file type using AI analysis
   */
  private async detectFileType(
    fileName: string,
    content: string,
    format: FileFormat
  ): Promise<FileType> {
    const lowerName = fileName.toLowerCase();

    // Quick detection based on filename patterns
    if (lowerName.includes('usage') || lowerName.includes('activity') || lowerName.includes('events')) {
      return 'usage_data';
    }
    if (lowerName.includes('ticket') || lowerName.includes('support') || lowerName.includes('case')) {
      return 'support_tickets';
    }
    if (lowerName.includes('nps') || lowerName.includes('survey') || lowerName.includes('feedback')) {
      return 'nps_survey';
    }
    if (lowerName.includes('meeting') || lowerName.includes('transcript') || lowerName.includes('notes')) {
      return 'meeting_notes';
    }
    if (lowerName.includes('invoice') || lowerName.includes('payment') || lowerName.includes('billing')) {
      return 'invoices';
    }
    if (lowerName.includes('contract') || lowerName.includes('agreement') || lowerName.includes('msa')) {
      return 'contracts';
    }
    if (lowerName.includes('email') || lowerName.includes('correspondence')) {
      return 'emails';
    }

    // For ambiguous files, use AI to detect
    try {
      const sampleContent = await this.getSampleContent(content, format);
      const prompt = `Analyze this file sample and determine its type. Return ONLY one of these values: usage_data, support_tickets, nps_survey, meeting_notes, invoices, contracts, emails, unknown

File: ${fileName}
Sample content:
${sampleContent.substring(0, 2000)}

Type:`;

      const response = await this.claude.generate(prompt);
      const detected = response.trim().toLowerCase().replace(/[^a-z_]/g, '');

      if (['usage_data', 'support_tickets', 'nps_survey', 'meeting_notes', 'invoices', 'contracts', 'emails'].includes(detected)) {
        return detected as FileType;
      }
    } catch (error) {
      console.error('File type detection failed:', error);
    }

    return 'unknown';
  }

  /**
   * Extract text content from file
   */
  private async extractTextContent(file: UploadedFile): Promise<string> {
    const buffer = Buffer.from(file.content, 'base64');

    switch (file.format) {
      case 'csv':
      case 'txt':
      case 'json':
        return buffer.toString('utf-8');

      case 'xlsx':
        return this.parseExcel(buffer);

      case 'pdf':
        return this.parsePDF(buffer);

      case 'docx':
        return this.parseDocx(buffer);

      default:
        return buffer.toString('utf-8');
    }
  }

  /**
   * Parse Excel file
   */
  private async parseExcel(buffer: Buffer): Promise<string> {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        text += `=== Sheet: ${sheetName} ===\n${csv}\n\n`;
      }

      return text;
    } catch (error) {
      console.error('Excel parsing error:', error);
      throw new Error('Failed to parse Excel file');
    }
  }

  /**
   * Parse PDF file
   */
  private async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF file');
    }
  }

  /**
   * Parse DOCX file
   */
  private async parseDocx(buffer: Buffer): Promise<string> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (error) {
      console.error('DOCX parsing error:', error);
      throw new Error('Failed to parse DOCX file');
    }
  }

  /**
   * Get sample content for type detection
   */
  private async getSampleContent(base64Content: string, format: FileFormat): Promise<string> {
    const buffer = Buffer.from(base64Content, 'base64');

    switch (format) {
      case 'csv':
      case 'txt':
      case 'json':
        return buffer.toString('utf-8').substring(0, 5000);

      case 'xlsx':
        return (await this.parseExcel(buffer)).substring(0, 5000);

      case 'pdf':
        return (await this.parsePDF(buffer)).substring(0, 5000);

      case 'docx':
        return (await this.parseDocx(buffer)).substring(0, 5000);

      default:
        return buffer.toString('utf-8').substring(0, 5000);
    }
  }

  /**
   * Extract structured data using AI
   */
  private async extractStructuredData(
    content: string,
    fileType: FileType,
    fileName: string,
    customerName: string
  ): Promise<any> {
    const prompts: Record<FileType, string> = {
      usage_data: `Extract usage data from this file for customer "${customerName}".
Return JSON with this structure:
{
  "records": [
    {
      "date": "YYYY-MM-DD",
      "user_id": "string",
      "user_name": "string (optional)",
      "feature": "string",
      "action": "string",
      "count": number,
      "duration_minutes": number (optional)
    }
  ],
  "summary": {
    "total_events": number,
    "unique_users": number,
    "top_features": ["string"],
    "date_range": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
  }
}`,

      support_tickets: `Extract support ticket data from this file for customer "${customerName}".
Return JSON with this structure:
{
  "tickets": [
    {
      "id": "string",
      "date": "YYYY-MM-DD",
      "subject": "string",
      "description": "string",
      "priority": "high|medium|low",
      "status": "open|pending|resolved|closed",
      "category": "string",
      "resolution_time_hours": number (optional),
      "csat_score": number (optional, 1-5),
      "escalated": boolean
    }
  ],
  "summary": {
    "total_tickets": number,
    "escalations": number,
    "avg_csat": number,
    "top_categories": ["string"]
  }
}`,

      nps_survey: `Extract NPS survey data from this file for customer "${customerName}".
Return JSON with this structure:
{
  "responses": [
    {
      "date": "YYYY-MM-DD",
      "respondent": "string (optional)",
      "score": number (0-10),
      "category": "promoter|passive|detractor",
      "feedback": "string (optional)",
      "themes": ["string"]
    }
  ],
  "summary": {
    "nps_score": number,
    "promoters": number,
    "passives": number,
    "detractors": number,
    "response_count": number,
    "common_themes": ["string"]
  }
}`,

      meeting_notes: `Extract meeting information from this file for customer "${customerName}".
Return JSON with this structure:
{
  "meetings": [
    {
      "date": "YYYY-MM-DD",
      "title": "string",
      "attendees": ["string"],
      "topics": ["string"],
      "action_items": ["string"],
      "sentiment": "positive|neutral|negative|mixed",
      "key_quotes": ["string"],
      "concerns_raised": ["string"],
      "opportunities_mentioned": ["string"]
    }
  ],
  "summary": {
    "total_meetings": number,
    "overall_sentiment": "positive|neutral|negative|mixed",
    "recurring_topics": ["string"],
    "key_stakeholders": ["string"]
  }
}`,

      invoices: `Extract invoice/payment data from this file for customer "${customerName}".
Return JSON with this structure:
{
  "invoices": [
    {
      "invoice_id": "string",
      "date": "YYYY-MM-DD",
      "due_date": "YYYY-MM-DD",
      "amount": number,
      "status": "paid|pending|overdue|cancelled",
      "paid_date": "YYYY-MM-DD (optional)",
      "days_late": number (optional),
      "items": ["string"]
    }
  ],
  "summary": {
    "total_invoiced": number,
    "total_paid": number,
    "total_outstanding": number,
    "on_time_payment_rate": number (percentage),
    "average_days_to_payment": number
  }
}`,

      contracts: `Extract contract information from this file for customer "${customerName}".
Return JSON with this structure:
{
  "contract": {
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "value": number,
    "term_months": number,
    "auto_renew": boolean,
    "products": ["string"],
    "terms": ["string"]
  },
  "amendments": [
    {
      "date": "YYYY-MM-DD",
      "type": "expansion|reduction|renewal|modification",
      "description": "string",
      "value_change": number
    }
  ]
}`,

      emails: `Extract email correspondence data from this file for customer "${customerName}".
Return JSON with this structure:
{
  "emails": [
    {
      "date": "YYYY-MM-DD",
      "from": "string",
      "to": ["string"],
      "subject": "string",
      "summary": "string",
      "sentiment": "positive|neutral|negative",
      "action_required": boolean,
      "topics": ["string"]
    }
  ],
  "summary": {
    "total_emails": number,
    "overall_sentiment": "positive|neutral|negative|mixed",
    "key_topics": ["string"],
    "response_rate": number (percentage)
  }
}`,

      unknown: `Analyze this file for customer "${customerName}" and extract any relevant customer success data.
Return JSON with this structure:
{
  "data_type": "string (your best guess)",
  "records": [
    {
      "date": "YYYY-MM-DD",
      "type": "string",
      "description": "string",
      "value": "any relevant value"
    }
  ],
  "summary": {
    "description": "string",
    "key_findings": ["string"]
  }
}`
    };

    const systemPrompt = `You are an expert data extraction assistant for Customer Success platforms.
Your task is to extract structured data from various file formats.
Always return valid JSON matching the requested schema.
If data is missing or unclear, use null or empty arrays.
Parse dates into ISO format (YYYY-MM-DD).
Be thorough but only include data that's clearly present.`;

    const prompt = `${prompts[fileType]}

File: ${fileName}
Content:
${content.substring(0, 50000)}

Return ONLY valid JSON, no markdown or explanation.`;

    try {
      const response = await this.claude.generate(prompt, systemPrompt, true);
      return this.parseJSON(response);
    } catch (claudeError) {
      console.log('Claude extraction failed, trying Gemini...');
      try {
        const result = await this.gemini.generateJSON(prompt);
        return result;
      } catch (geminiError) {
        console.error('Both AI services failed for extraction');
        throw new Error('Failed to extract structured data');
      }
    }
  }

  /**
   * Parse JSON from AI response
   */
  private parseJSON(text: string): any {
    let jsonString = text.trim();

    // Remove markdown code blocks
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.substring(7);
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.substring(3);
    }
    if (jsonString.endsWith('```')) {
      jsonString = jsonString.slice(0, -3);
    }

    // Find JSON object or array
    const jsonMatch = jsonString.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }

    return JSON.parse(jsonString);
  }

  /**
   * Convert extracted data to timeline events
   */
  private convertToEvents(data: any, fileType: FileType): ExtractedEvent[] {
    const events: ExtractedEvent[] = [];

    switch (fileType) {
      case 'usage_data':
        if (data.records) {
          // Aggregate by date for usage data
          const byDate = new Map<string, any[]>();
          for (const record of data.records) {
            if (!record.date) continue;
            const dateEvents = byDate.get(record.date) || [];
            dateEvents.push(record);
            byDate.set(record.date, dateEvents);
          }

          for (const [date, records] of byDate) {
            const totalEvents = records.reduce((sum, r) => sum + (r.count || 1), 0);
            const uniqueUsers = new Set(records.map(r => r.user_id)).size;
            const features = [...new Set(records.map(r => r.feature))];

            events.push({
              id: uuidv4(),
              date,
              source: 'usage',
              type: 'daily_usage',
              title: `${totalEvents} usage events`,
              description: `${uniqueUsers} users active, features: ${features.slice(0, 3).join(', ')}`,
              severity: totalEvents > 100 ? 'positive' : totalEvents < 10 ? 'warning' : 'neutral',
              metrics: { total_events: totalEvents, unique_users: uniqueUsers },
              confidence: 0.9
            });
          }
        }
        break;

      case 'support_tickets':
        if (data.tickets) {
          for (const ticket of data.tickets) {
            const severity = ticket.escalated ? 'critical' :
              ticket.priority === 'high' ? 'warning' :
                ticket.csat_score && ticket.csat_score < 3 ? 'warning' : 'neutral';

            events.push({
              id: uuidv4(),
              date: ticket.date,
              source: 'support',
              type: 'support_ticket',
              title: ticket.subject || `Ticket #${ticket.id}`,
              description: ticket.description?.substring(0, 200) || '',
              severity,
              metrics: {
                priority: ticket.priority,
                status: ticket.status,
                csat: ticket.csat_score,
                escalated: ticket.escalated ? 1 : 0
              },
              confidence: 0.95
            });
          }
        }
        break;

      case 'nps_survey':
        if (data.responses) {
          // Group responses by date
          const byDate = new Map<string, any[]>();
          for (const response of data.responses) {
            if (!response.date) continue;
            const dateResponses = byDate.get(response.date) || [];
            dateResponses.push(response);
            byDate.set(response.date, dateResponses);
          }

          for (const [date, responses] of byDate) {
            const avgScore = responses.reduce((sum, r) => sum + r.score, 0) / responses.length;
            const nps = this.calculateNPS(responses.map(r => r.score));

            events.push({
              id: uuidv4(),
              date,
              source: 'nps',
              type: 'nps_response',
              title: `NPS Score: ${nps > 0 ? '+' : ''}${nps}`,
              description: `${responses.length} responses, avg score ${avgScore.toFixed(1)}/10`,
              severity: nps >= 30 ? 'positive' : nps < 0 ? 'critical' : nps < 20 ? 'warning' : 'neutral',
              metrics: { nps_score: nps, response_count: responses.length, avg_score: avgScore },
              confidence: 0.95
            });
          }
        }
        break;

      case 'meeting_notes':
        if (data.meetings) {
          for (const meeting of data.meetings) {
            const severity = meeting.sentiment === 'negative' ? 'critical' :
              meeting.sentiment === 'positive' ? 'positive' :
                meeting.concerns_raised?.length > 0 ? 'warning' : 'neutral';

            events.push({
              id: uuidv4(),
              date: meeting.date,
              source: 'meeting',
              type: 'meeting',
              title: meeting.title || 'Customer Meeting',
              description: `Attendees: ${meeting.attendees?.join(', ') || 'N/A'}. Topics: ${meeting.topics?.slice(0, 3).join(', ') || 'N/A'}`,
              severity,
              metrics: {
                attendee_count: meeting.attendees?.length || 0,
                action_items: meeting.action_items?.length || 0,
                concerns: meeting.concerns_raised?.length || 0
              },
              confidence: 0.85
            });
          }
        }
        break;

      case 'invoices':
        if (data.invoices) {
          for (const invoice of data.invoices) {
            const severity = invoice.status === 'overdue' ? 'critical' :
              invoice.days_late && invoice.days_late > 0 ? 'warning' :
                invoice.status === 'paid' ? 'positive' : 'neutral';

            events.push({
              id: uuidv4(),
              date: invoice.paid_date || invoice.due_date || invoice.date,
              source: 'invoice',
              type: 'invoice',
              title: `Invoice ${invoice.invoice_id}: $${invoice.amount?.toLocaleString() || 0}`,
              description: `Status: ${invoice.status}${invoice.days_late ? `, ${invoice.days_late} days late` : ''}`,
              severity,
              metrics: {
                amount: invoice.amount,
                days_late: invoice.days_late || 0,
                status: invoice.status
              },
              confidence: 0.95
            });
          }
        }
        break;

      case 'emails':
        if (data.emails) {
          for (const email of data.emails) {
            const severity = email.sentiment === 'negative' ? 'warning' :
              email.action_required ? 'neutral' :
                email.sentiment === 'positive' ? 'positive' : 'neutral';

            events.push({
              id: uuidv4(),
              date: email.date,
              source: 'email',
              type: 'email',
              title: email.subject || 'Email',
              description: email.summary || '',
              severity,
              metrics: {
                sentiment: email.sentiment,
                action_required: email.action_required ? 1 : 0
              },
              confidence: 0.8
            });
          }
        }
        break;
    }

    return events;
  }

  /**
   * Calculate NPS from scores
   */
  private calculateNPS(scores: number[]): number {
    if (scores.length === 0) return 0;

    const promoters = scores.filter(s => s >= 9).length;
    const detractors = scores.filter(s => s <= 6).length;

    return Math.round(((promoters - detractors) / scores.length) * 100);
  }

  /**
   * Calculate key metrics for a file type
   */
  private calculateKeyMetrics(data: any, fileType: FileType): Record<string, string | number> {
    switch (fileType) {
      case 'usage_data':
        return data.summary || {
          total_events: data.records?.length || 0,
          unique_users: new Set(data.records?.map((r: any) => r.user_id)).size || 0
        };

      case 'support_tickets':
        return data.summary || {
          total_tickets: data.tickets?.length || 0,
          escalations: data.tickets?.filter((t: any) => t.escalated).length || 0
        };

      case 'nps_survey':
        return data.summary || {
          response_count: data.responses?.length || 0,
          nps_score: this.calculateNPS(data.responses?.map((r: any) => r.score) || [])
        };

      case 'meeting_notes':
        return data.summary || {
          total_meetings: data.meetings?.length || 0
        };

      case 'invoices':
        return data.summary || {
          total_invoiced: data.invoices?.reduce((sum: number, i: any) => sum + (i.amount || 0), 0) || 0,
          invoices_count: data.invoices?.length || 0
        };

      default:
        return {};
    }
  }

  /**
   * Get a processing session by ID
   */
  getSession(sessionId: string): ProcessingSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a customer
   */
  getCustomerSessions(customerId: string): ProcessingSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.customerId === customerId);
  }
}

// Export singleton instance
export const multiFileProcessor = new MultiFileProcessor();
