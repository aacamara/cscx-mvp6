/**
 * Checklist Parser Service (PRD-012)
 *
 * Parses onboarding checklists from various formats:
 * - Excel (.xlsx, .xls)
 * - CSV
 * - Asana/Monday/Jira exports
 * - Google Sheets
 */

import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import {
  ChecklistTask,
  ChecklistUploadInput,
  ParsedChecklist,
  ColumnMapping,
  ChecklistSource,
  TaskStatus,
  OnboardingPhase,
  TaskPriority,
  TaskOwnerType,
  STATUS_KEYWORDS,
  PHASE_KEYWORDS,
  PRIORITY_KEYWORDS,
  PHASE_ORDER
} from './checklistTypes.js';

// ============================================
// Checklist Parser Class
// ============================================

export class ChecklistParser {
  /**
   * Parse a checklist from uploaded content
   */
  async parse(input: ChecklistUploadInput): Promise<ParsedChecklist> {
    const { content, fileName, mimeType } = input;
    let rawData: string[][];
    let detectedSource: ChecklistSource = 'manual';
    const warnings: string[] = [];

    try {
      // Determine file type and parse accordingly
      if (mimeType.includes('spreadsheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        rawData = this.parseExcel(content);
        detectedSource = 'excel';
      } else if (mimeType.includes('csv') || fileName.endsWith('.csv')) {
        rawData = this.parseCSV(content);
        detectedSource = 'csv';
      } else if (mimeType.includes('json') || fileName.endsWith('.json')) {
        // Could be Asana, Monday, or Jira export
        const jsonData = this.parseJSON(content);
        detectedSource = this.detectJSONSource(jsonData);
        rawData = this.convertJSONToRows(jsonData, detectedSource);
      } else {
        // Try CSV as fallback
        rawData = this.parseCSV(content);
        detectedSource = 'csv';
        warnings.push('Unknown file type, attempting CSV parse');
      }

      if (rawData.length < 2) {
        throw new Error('File must have at least a header row and one data row');
      }

      // Detect column mapping from headers
      const headers = rawData[0].map(h => String(h || '').toLowerCase().trim());
      const columnMapping = this.detectColumnMapping(headers);

      if (columnMapping.taskName < 0) {
        throw new Error('Could not detect task name column. Please ensure your file has a column named "Task", "Name", or "Title"');
      }

      // Parse tasks from rows
      const tasks: ChecklistTask[] = [];
      let validRows = 0;
      let skippedRows = 0;

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const task = this.parseTaskFromRow(row, columnMapping, i);

        if (task) {
          tasks.push(task);
          validRows++;
        } else {
          skippedRows++;
        }
      }

      // Infer phases if not explicitly provided
      if (!columnMapping.phase || columnMapping.phase < 0) {
        this.inferPhases(tasks);
        warnings.push('Phase column not detected, phases inferred from task names');
      }

      // Detect dependencies from task names
      this.detectDependencies(tasks);

      // Calculate confidence score
      const parseConfidence = this.calculateConfidence(columnMapping, validRows, rawData.length - 1);

      return {
        tasks,
        columnMapping,
        detectedSource,
        parseConfidence,
        warnings,
        totalRows: rawData.length - 1,
        validRows,
        skippedRows
      };
    } catch (error) {
      console.error('Checklist parse error:', error);
      throw new Error(`Failed to parse checklist: ${(error as Error).message}`);
    }
  }

  /**
   * Parse Excel file from base64 content
   */
  private parseExcel(base64Content: string): string[][] {
    const buffer = Buffer.from(base64Content, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to array of arrays
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
    return data as string[][];
  }

  /**
   * Parse CSV content (base64 or raw)
   */
  private parseCSV(content: string): string[][] {
    let csvText: string;

    // Check if base64 encoded
    if (content.includes('base64,')) {
      content = content.split('base64,')[1];
    }

    try {
      // Try decoding as base64
      csvText = Buffer.from(content, 'base64').toString('utf-8');
    } catch {
      // Assume it's raw CSV
      csvText = content;
    }

    // Parse CSV (handle quoted fields and commas)
    const rows: string[][] = [];
    const lines = csvText.split(/\r?\n/);

    for (const line of lines) {
      if (line.trim() === '') continue;
      const row = this.parseCSVLine(line);
      rows.push(row);
    }

    return rows;
  }

  /**
   * Parse a single CSV line handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Parse JSON content (for PM tool exports)
   */
  private parseJSON(content: string): Record<string, unknown> {
    let jsonText: string;

    try {
      jsonText = Buffer.from(content, 'base64').toString('utf-8');
    } catch {
      jsonText = content;
    }

    return JSON.parse(jsonText);
  }

  /**
   * Detect if JSON is from Asana, Monday, or Jira
   */
  private detectJSONSource(json: Record<string, unknown>): ChecklistSource {
    // Asana export detection
    if (json.data && Array.isArray(json.data) && (json as any).data[0]?.gid) {
      return 'asana';
    }

    // Monday export detection
    if (json.boards || (json as any).data?.boards) {
      return 'monday';
    }

    // Jira export detection
    if ((json as any).issues || (json as any).sprint || (json as any).projects) {
      return 'jira';
    }

    // Notion export detection
    if ((json as any).results && (json as any).object === 'list') {
      return 'notion';
    }

    return 'manual';
  }

  /**
   * Convert JSON export to row format
   */
  private convertJSONToRows(json: Record<string, unknown>, source: ChecklistSource): string[][] {
    const headers = ['Task', 'Owner', 'Status', 'Due Date', 'Phase', 'Description', 'Priority'];
    const rows: string[][] = [headers];

    if (source === 'asana' && json.data && Array.isArray(json.data)) {
      for (const task of (json as any).data) {
        rows.push([
          task.name || '',
          task.assignee?.name || '',
          task.completed ? 'completed' : 'in_progress',
          task.due_on || '',
          task.memberships?.[0]?.section?.name || '',
          task.notes || '',
          task.priority || 'medium'
        ]);
      }
    } else if (source === 'jira' && (json as any).issues) {
      for (const issue of (json as any).issues) {
        rows.push([
          issue.fields?.summary || '',
          issue.fields?.assignee?.displayName || '',
          issue.fields?.status?.name || '',
          issue.fields?.duedate || '',
          issue.fields?.customfield_10001?.value || issue.fields?.labels?.[0] || '',
          issue.fields?.description || '',
          issue.fields?.priority?.name || 'medium'
        ]);
      }
    }

    return rows;
  }

  /**
   * Detect column mapping from headers
   */
  private detectColumnMapping(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {
      taskName: -1
    };

    const taskNamePatterns = ['task', 'name', 'title', 'summary', 'item', 'action', 'activity', 'todo'];
    const ownerPatterns = ['owner', 'assignee', 'assigned', 'responsible', 'who', 'contact', 'person'];
    const statusPatterns = ['status', 'state', 'progress', 'done', 'complete', 'completed'];
    const dueDatePatterns = ['due', 'date', 'deadline', 'target', 'by'];
    const phasePatterns = ['phase', 'stage', 'section', 'category', 'milestone', 'sprint'];
    const descPatterns = ['description', 'desc', 'details', 'notes', 'comment'];
    const depsPatterns = ['dependencies', 'depends', 'blockers', 'blocked', 'prerequisite', 'after'];
    const priorityPatterns = ['priority', 'importance', 'urgency', 'p0', 'p1', 'p2'];

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();

      if (mapping.taskName < 0 && taskNamePatterns.some(p => header.includes(p))) {
        mapping.taskName = i;
      } else if (!mapping.owner && ownerPatterns.some(p => header.includes(p))) {
        mapping.owner = i;
      } else if (!mapping.status && statusPatterns.some(p => header.includes(p))) {
        mapping.status = i;
      } else if (!mapping.dueDate && dueDatePatterns.some(p => header.includes(p))) {
        mapping.dueDate = i;
      } else if (!mapping.phase && phasePatterns.some(p => header.includes(p))) {
        mapping.phase = i;
      } else if (!mapping.description && descPatterns.some(p => header.includes(p))) {
        mapping.description = i;
      } else if (!mapping.dependencies && depsPatterns.some(p => header.includes(p))) {
        mapping.dependencies = i;
      } else if (!mapping.priority && priorityPatterns.some(p => header.includes(p))) {
        mapping.priority = i;
      }
    }

    // Fallback: if no task name found, use first non-empty column
    if (mapping.taskName < 0) {
      mapping.taskName = 0;
    }

    return mapping;
  }

  /**
   * Parse a single task from a row
   */
  private parseTaskFromRow(
    row: string[],
    mapping: ColumnMapping,
    rowIndex: number
  ): ChecklistTask | null {
    const taskName = row[mapping.taskName]?.trim();

    // Skip empty rows or header-like rows
    if (!taskName || taskName.toLowerCase() === 'task' || taskName.toLowerCase() === 'name') {
      return null;
    }

    const owner = mapping.owner !== undefined ? row[mapping.owner]?.trim() || 'Unassigned' : 'Unassigned';
    const statusRaw = mapping.status !== undefined ? row[mapping.status]?.trim() || '' : '';
    const dueDateRaw = mapping.dueDate !== undefined ? row[mapping.dueDate]?.trim() || '' : '';
    const phaseRaw = mapping.phase !== undefined ? row[mapping.phase]?.trim() || '' : '';
    const description = mapping.description !== undefined ? row[mapping.description]?.trim() : undefined;
    const dependenciesRaw = mapping.dependencies !== undefined ? row[mapping.dependencies]?.trim() : undefined;
    const priorityRaw = mapping.priority !== undefined ? row[mapping.priority]?.trim() || '' : '';

    // Parse status
    const status = this.parseStatus(statusRaw);

    // Parse due date
    const dueDate = this.parseDate(dueDateRaw);

    // Parse phase
    const phase = this.parsePhase(phaseRaw || taskName);

    // Parse priority
    const priority = this.parsePriority(priorityRaw || taskName);

    // Parse dependencies
    const dependencies = dependenciesRaw ? dependenciesRaw.split(/[,;]/).map(d => d.trim()).filter(Boolean) : undefined;

    // Determine owner type
    const ownerType = this.detectOwnerType(owner, taskName);

    // Check if task is blocked
    const isBlocked = status === 'blocked' || taskName.toLowerCase().includes('blocked');
    const blockerReason = isBlocked ? this.extractBlockerReason(taskName, description) : undefined;

    return {
      id: uuidv4(),
      name: taskName,
      description,
      owner,
      ownerType,
      status,
      dueDate: dueDate || undefined,
      phase,
      dependencies,
      blockerReason,
      priority,
      originalRowIndex: rowIndex
    };
  }

  /**
   * Parse status from raw text
   */
  private parseStatus(raw: string): TaskStatus {
    const normalized = raw.toLowerCase().trim();

    for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
      if (keywords.some(k => normalized === k || normalized.includes(k))) {
        return status as TaskStatus;
      }
    }

    // Check percentage completion
    const percentMatch = normalized.match(/(\d+)%/);
    if (percentMatch) {
      const percent = parseInt(percentMatch[1], 10);
      if (percent >= 100) return 'completed';
      if (percent > 0) return 'in_progress';
    }

    return 'not_started';
  }

  /**
   * Parse date from various formats
   */
  private parseDate(raw: string): Date | null {
    if (!raw) return null;

    // Handle Excel serial date numbers
    if (!isNaN(Number(raw))) {
      const serial = Number(raw);
      if (serial > 25569) {
        // Excel serial date
        return new Date((serial - 25569) * 86400 * 1000);
      }
    }

    // Try standard date parsing
    const date = new Date(raw);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try common formats
    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, // MM/DD/YYYY or DD/MM/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      /(\d{1,2})-(\w{3})-(\d{2,4})/ // DD-Mon-YYYY
    ];

    for (const format of formats) {
      const match = raw.match(format);
      if (match) {
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    return null;
  }

  /**
   * Parse phase from raw text or infer from task name
   */
  private parsePhase(raw: string): OnboardingPhase {
    const normalized = raw.toLowerCase();

    for (const [phase, keywords] of Object.entries(PHASE_KEYWORDS)) {
      if (keywords.some(k => normalized.includes(k))) {
        return phase as OnboardingPhase;
      }
    }

    return 'setup'; // Default phase
  }

  /**
   * Parse priority from raw text
   */
  private parsePriority(raw: string): TaskPriority {
    const normalized = raw.toLowerCase();

    for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
      if (keywords.some(k => normalized.includes(k))) {
        return priority as TaskPriority;
      }
    }

    return 'medium'; // Default priority
  }

  /**
   * Detect owner type from name and task context
   */
  private detectOwnerType(owner: string, taskName: string): TaskOwnerType {
    const lowerOwner = owner.toLowerCase();
    const lowerTask = taskName.toLowerCase();

    const customerKeywords = ['client', 'customer', 'their', 'external', 'acme', 'corp'];
    const vendorKeywords = ['vendor', 'partner', 'third party', '3rd party', 'contractor'];
    const internalKeywords = ['csm', 'internal', 'us', 'our', 'team', 'engineer', 'support'];

    // Check owner name
    if (customerKeywords.some(k => lowerOwner.includes(k))) return 'customer';
    if (vendorKeywords.some(k => lowerOwner.includes(k))) return 'vendor';
    if (internalKeywords.some(k => lowerOwner.includes(k))) return 'internal';

    // Check task name for context
    if (lowerTask.includes('customer') || lowerTask.includes('client') || lowerTask.includes('their')) return 'customer';
    if (lowerTask.includes('vendor') || lowerTask.includes('partner')) return 'vendor';

    // Default to customer if mentions external party, otherwise internal
    if (lowerOwner.includes('@') && !lowerOwner.includes('company.com')) return 'customer';

    return 'internal';
  }

  /**
   * Extract blocker reason from task context
   */
  private extractBlockerReason(taskName: string, description?: string): string | undefined {
    const patterns = [
      /blocked[:\-\s]+(.+)/i,
      /waiting[:\-\s]+(.+)/i,
      /pending[:\-\s]+(.+)/i,
      /depends on[:\-\s]+(.+)/i
    ];

    const text = `${taskName} ${description || ''}`;

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Infer phases from task names when no phase column exists
   */
  private inferPhases(tasks: ChecklistTask[]): void {
    // Group sequential tasks and assign phases based on task characteristics
    const totalTasks = tasks.length;
    const tasksPerPhase = Math.ceil(totalTasks / PHASE_ORDER.length);

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      // First try to infer from task name
      const inferred = this.parsePhase(task.name);
      if (inferred !== 'setup') {
        task.phase = inferred;
        continue;
      }

      // Fall back to position-based assignment
      const phaseIndex = Math.min(
        Math.floor(i / tasksPerPhase),
        PHASE_ORDER.length - 1
      );
      task.phase = PHASE_ORDER[phaseIndex];
    }
  }

  /**
   * Detect dependencies between tasks
   */
  private detectDependencies(tasks: ChecklistTask[]): void {
    // Build a map of task names for reference
    const taskNameMap = new Map<string, string>();
    for (const task of tasks) {
      const normalizedName = task.name.toLowerCase().trim();
      taskNameMap.set(normalizedName, task.id);
    }

    // Look for dependency indicators in task names
    for (const task of tasks) {
      const lowerName = task.name.toLowerCase();

      // Check for "after X" or "following X" patterns
      const afterMatch = lowerName.match(/after\s+(.+)|following\s+(.+)/i);
      if (afterMatch) {
        const depName = (afterMatch[1] || afterMatch[2]).trim();
        const depId = taskNameMap.get(depName);
        if (depId) {
          task.dependencies = task.dependencies || [];
          if (!task.dependencies.includes(depId)) {
            task.dependencies.push(depId);
          }
        }
      }

      // Check for blocking relationships
      if (task.blockerReason) {
        for (const [name, id] of taskNameMap) {
          if (task.blockerReason.toLowerCase().includes(name) && id !== task.id) {
            task.dependencies = task.dependencies || [];
            if (!task.dependencies.includes(id)) {
              task.dependencies.push(id);
            }
          }
        }
      }
    }
  }

  /**
   * Calculate parse confidence score
   */
  private calculateConfidence(mapping: ColumnMapping, validRows: number, totalRows: number): number {
    let score = 0;

    // Base score for finding task name
    if (mapping.taskName >= 0) score += 20;

    // Bonus for each additional column detected
    if (mapping.owner !== undefined && mapping.owner >= 0) score += 15;
    if (mapping.status !== undefined && mapping.status >= 0) score += 15;
    if (mapping.dueDate !== undefined && mapping.dueDate >= 0) score += 15;
    if (mapping.phase !== undefined && mapping.phase >= 0) score += 10;
    if (mapping.description !== undefined && mapping.description >= 0) score += 5;
    if (mapping.dependencies !== undefined && mapping.dependencies >= 0) score += 5;
    if (mapping.priority !== undefined && mapping.priority >= 0) score += 5;

    // Adjust for row validity
    const validRatio = totalRows > 0 ? validRows / totalRows : 0;
    score = Math.round(score * validRatio);

    // Cap at 100
    return Math.min(score, 100);
  }
}

// ============================================
// Export Singleton
// ============================================

export const checklistParser = new ChecklistParser();
export default checklistParser;
