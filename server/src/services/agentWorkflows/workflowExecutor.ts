/**
 * Workflow Executor Service
 *
 * Executes agent workflows by orchestrating multiple Google Workspace services.
 * Handles data fetching, processing, output creation, and HITL approval.
 *
 * Supports DEMO_MODE when Google is not connected - uses simulated data.
 */

import { EventEmitter } from 'events';
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowContext,
  WorkflowStatus,
  WorkflowStep,
  WorkflowOutput,
  DataSource,
  SheetQuery,
  DriveQuery,
  GmailQuery,
  CalendarQuery,
} from './types.js';

import {
  driveService,
  gmailService,
  calendarService,
  sheetsService,
  docsService,
  slidesService,
  customerWorkspaceService,
} from '../google/index.js';

import { tokenStore } from '../google/oauth.js';

// In-memory store for executions (replace with Supabase in production)
const executions = new Map<string, WorkflowExecution>();

// Check if user has Google connected
async function isGoogleConnected(userId: string): Promise<boolean> {
  try {
    const tokens = await tokenStore.getTokens(userId);
    return !!tokens?.access_token;
  } catch {
    return false;
  }
}

class WorkflowExecutor extends EventEmitter {
  /**
   * Execute a workflow
   */
  async execute(
    workflow: WorkflowDefinition,
    context: WorkflowContext,
    input: Record<string, unknown> = {}
  ): Promise<WorkflowExecution> {
    const executionId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Check if Google is connected - if not, use demo mode
    const googleConnected = await isGoogleConnected(context.userId);
    const demoMode = !googleConnected;

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      agentType: context.agentType,
      userId: context.userId,
      customerId: context.customerId,
      customerName: context.customerName,
      status: 'pending',
      steps: workflow.steps.map(step => ({
        id: step.id,
        name: step.name,
        status: 'pending' as WorkflowStatus,
      })),
      input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    executions.set(executionId, execution);
    this.emit('execution:start', execution);

    try {
      if (demoMode) {
        // DEMO MODE: Simulate workflow execution with delays
        return await this.executeDemoMode(workflow, execution, context);
      }

      // PRODUCTION MODE: Use real Google Workspace services
      // Step 1: Fetch data from all sources
      await this.updateStepStatus(execution, 'fetch', 'fetching');
      const fetchedData = await this.fetchAllData(workflow.dataSources, context);
      context.fetchedData = fetchedData;
      await this.updateStepStatus(execution, 'fetch', 'completed', { fetchedData });

      // Step 2: Process the data
      await this.updateStepStatus(execution, 'process', 'processing');
      const processedData = await this.processData(workflow, context, fetchedData);
      await this.updateStepStatus(execution, 'process', 'completed', { processedData });

      // Step 3: Create outputs
      await this.updateStepStatus(execution, 'create', 'creating');
      const outputs = await this.createOutputs(workflow, context, processedData);
      await this.updateStepStatus(execution, 'create', 'completed', { outputs });

      // Step 4: Prepare for review
      execution.output = this.buildOutput(workflow, outputs, processedData);
      execution.status = workflow.requiresApproval ? 'awaiting_review' : 'completed';
      execution.updatedAt = new Date();

      if (!workflow.requiresApproval) {
        execution.completedAt = new Date();
      }

      executions.set(executionId, execution);
      this.emit('execution:ready', execution);

      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.error = (error as Error).message;
      execution.updatedAt = new Date();
      executions.set(executionId, execution);
      this.emit('execution:failed', execution);
      throw error;
    }
  }

  /**
   * Execute workflow in demo mode with simulated data
   */
  private async executeDemoMode(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    context: WorkflowContext
  ): Promise<WorkflowExecution> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Step 1: Simulate fetching
    await this.updateStepStatus(execution, 'fetch', 'fetching');
    await delay(1500);
    const demoFetchedData = this.generateDemoData(workflow, context);
    await this.updateStepStatus(execution, 'fetch', 'completed', { fetchedData: demoFetchedData });

    // Step 2: Simulate processing
    await this.updateStepStatus(execution, 'process', 'processing');
    await delay(1200);
    const processedData = {
      ...demoFetchedData,
      customer: {
        id: context.customerId,
        name: context.customerName,
        arr: context.customerARR,
        renewalDate: context.renewalDate,
        healthScore: context.healthScore,
      },
      processedAt: new Date().toISOString(),
    };
    await this.updateStepStatus(execution, 'process', 'completed', { processedData });

    // Step 3: Simulate creating outputs
    await this.updateStepStatus(execution, 'create', 'creating');
    await delay(1000);
    const demoOutputs = this.generateDemoOutputs(workflow, context);
    await this.updateStepStatus(execution, 'create', 'completed', { outputs: demoOutputs });

    // Step 4: Notify ready for review
    await this.updateStepStatus(execution, 'notify', 'completed');

    // Build output for chat
    execution.output = {
      files: demoOutputs.map(o => ({
        type: o.type as 'doc' | 'sheet' | 'slide' | 'folder',
        id: o.id,
        name: o.name,
        url: o.url,
      })),
      summary: `**Demo Mode** - I've simulated the **${workflow.name}** workflow.\n\n` +
        `In production with Google Workspace connected, the following files would be created:\n\n` +
        demoOutputs.map(o => `- **${o.name}** (${o.type})`).join('\n') +
        `\n\n${workflow.approvalMessage || 'Please review and approve to continue.'}`,
      reviewData: processedData,
      demoMode: true,
      actions: workflow.requiresApproval
        ? [
            { id: 'approve', label: 'Approve', type: 'approve' as const },
            { id: 'reject', label: 'Reject', type: 'reject' as const },
          ]
        : [],
    };

    execution.status = workflow.requiresApproval ? 'awaiting_review' : 'completed';
    execution.updatedAt = new Date();

    if (!workflow.requiresApproval) {
      execution.completedAt = new Date();
    }

    executions.set(execution.id, execution);
    this.emit('execution:ready', execution);

    return execution;
  }

  /**
   * Generate demo data for workflow
   */
  private generateDemoData(
    workflow: WorkflowDefinition,
    context: WorkflowContext
  ): Record<string, unknown> {
    return {
      sheet_data: {
        spreadsheet: { title: `Health Score - ${context.customerName}` },
        data: [
          ['Date', 'Overall', 'Usage', 'Engagement', 'Support', 'Sentiment'],
          ['2024-01-01', '85', '90', '82', '88', '80'],
          ['2024-01-15', '82', '85', '80', '85', '78'],
          ['2024-02-01', '78', '75', '76', '82', '79'],
        ],
      },
      drive_data: {
        files: [
          { name: `Contract - ${context.customerName}.pdf`, type: 'pdf' },
          { name: `Meeting Notes - Q4.docx`, type: 'doc' },
        ],
        count: 2,
      },
      gmail_data: {
        threads: [
          { subject: `Re: ${context.customerName} - Q1 Planning`, from: 'customer@example.com' },
          { subject: 'Thanks for the great training!', from: 'user@example.com' },
        ],
        count: 2,
      },
      calendar_data: {
        events: [
          { title: `QBR - ${context.customerName}`, date: '2024-02-15' },
          { title: `Check-in Call`, date: '2024-02-22' },
        ],
        count: 2,
      },
    };
  }

  /**
   * Generate demo output files
   */
  private generateDemoOutputs(
    workflow: WorkflowDefinition,
    context: WorkflowContext
  ): Array<{ type: string; id: string; name: string; url: string }> {
    return workflow.outputs.map((outputDef, idx) => {
      let name = outputDef.name.replace('{customerName}', context.customerName);
      name = name.replace('{date}', new Date().toISOString().split('T')[0]);

      return {
        type: outputDef.type,
        id: `demo_${outputDef.type}_${idx}`,
        name,
        url: '#demo-mode',
      };
    });
  }

  /**
   * Fetch data from all configured sources
   */
  private async fetchAllData(
    dataSources: DataSource[],
    context: WorkflowContext
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    for (const source of dataSources) {
      const key = `${source.type}_data`;
      try {
        switch (source.query.type) {
          case 'sheet':
            results[key] = await this.fetchSheetData(source.query, context);
            break;
          case 'drive':
            results[key] = await this.fetchDriveData(source.query, context);
            break;
          case 'gmail':
            results[key] = await this.fetchGmailData(source.query, context);
            break;
          case 'calendar':
            results[key] = await this.fetchCalendarData(source.query, context);
            break;
        }

        // Apply transform if provided
        if (source.transform && results[key]) {
          results[key] = source.transform(results[key]);
        }
      } catch (error) {
        console.error(`Failed to fetch ${source.type} data:`, error);
        results[`${key}_error`] = (error as Error).message;
      }
    }

    return results;
  }

  /**
   * Fetch data from Google Sheets
   */
  private async fetchSheetData(
    query: SheetQuery,
    context: WorkflowContext
  ): Promise<unknown> {
    const { userId, customerId, customerName } = context;

    // Get customer workspace to find sheets
    const workspace = await customerWorkspaceService.getOrCreateWorkspace(
      customerId,
      customerName,
      userId
    );

    let spreadsheetId = query.spreadsheetId;

    // If no specific ID, search by name in customer workspace
    if (!spreadsheetId && query.spreadsheetName) {
      const files = await driveService.searchFiles(userId, {
        query: query.spreadsheetName,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parentId: workspace.folders.root,
      });
      if (files.length > 0) {
        spreadsheetId = files[0].id;
      }
    }

    if (!spreadsheetId) {
      return null;
    }

    const sheet = await sheetsService.getSpreadsheet(userId, spreadsheetId);
    const sheetData = await sheetsService.readRange(
      userId,
      spreadsheetId,
      query.range || 'A1:Z1000'
    );

    return {
      spreadsheet: sheet,
      data: sheetData,
      range: query.range,
    };
  }

  /**
   * Fetch files from Google Drive
   */
  private async fetchDriveData(
    query: DriveQuery,
    context: WorkflowContext
  ): Promise<unknown> {
    const { userId, customerId, customerName } = context;

    // Get customer workspace
    const workspace = await customerWorkspaceService.getOrCreateWorkspace(
      customerId,
      customerName,
      userId
    );

    // Determine folder to search
    let folderId = query.folderId || workspace.folders.root;

    // Map folder path to workspace folder
    if (query.folderPath) {
      const folderMap: Record<string, string> = {
        'Contracts': workspace.folders.onboarding,
        'Onboarding': workspace.folders.onboarding,
        'Meetings': workspace.folders.meetings,
        'QBRs': workspace.folders.qbrs,
        'Reports': workspace.folders.success,
        'Health': workspace.folders.health,
        'Risk': workspace.folders.risk,
        'Renewals': workspace.folders.renewals,
        'Success': workspace.folders.success,
      };
      folderId = folderMap[query.folderPath] || folderId;
    }

    const files = await driveService.searchFiles(userId, {
      query: query.nameContains,
      parentId: folderId,
      maxResults: query.maxResults || 20,
    });

    // Get file contents for documents
    const filesWithContent = await Promise.all(
      files.slice(0, 5).map(async (file) => {
        let content = null;
        if (file.mimeType?.includes('document')) {
          try {
            content = await docsService.getDocumentText(userId, file.id);
          } catch (e) {
            // Ignore content fetch errors
          }
        }
        return { ...file, content };
      })
    );

    return {
      files: filesWithContent,
      folder: folderId,
      count: files.length,
    };
  }

  /**
   * Fetch emails from Gmail
   */
  private async fetchGmailData(
    query: GmailQuery,
    context: WorkflowContext
  ): Promise<unknown> {
    const { userId, customerName } = context;

    // Build Gmail search query
    let searchQuery = query.query || '';

    if (query.from) {
      searchQuery += ` from:${query.from}`;
    }
    if (query.to) {
      searchQuery += ` to:${query.to}`;
    }
    if (query.subject) {
      searchQuery += ` subject:${query.subject}`;
    }
    if (query.hasAttachment) {
      searchQuery += ' has:attachment';
    }

    // Default: search for customer name in emails
    if (!searchQuery) {
      searchQuery = customerName;
    }

    const threads = await gmailService.searchEmails(
      userId,
      searchQuery.trim(),
      query.maxResults || 10
    );

    return {
      threads,
      query: searchQuery,
      count: threads.length,
    };
  }

  /**
   * Fetch events from Google Calendar
   */
  private async fetchCalendarData(
    query: CalendarQuery,
    context: WorkflowContext
  ): Promise<unknown> {
    const { userId } = context;

    const timeMin = query.timeMin || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const timeMax = query.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const events = await calendarService.listEvents(userId, timeMin, timeMax);

    // Filter by query if provided
    let filtered = events;
    if (query.query) {
      const q = query.query.toLowerCase();
      filtered = events.filter(
        e => e.title?.toLowerCase().includes(q) ||
             e.description?.toLowerCase().includes(q)
      );
    }

    return {
      events: filtered.slice(0, query.maxResults || 20),
      timeRange: { start: timeMin, end: timeMax },
      count: filtered.length,
    };
  }

  /**
   * Process fetched data according to workflow logic
   */
  private async processData(
    workflow: WorkflowDefinition,
    context: WorkflowContext,
    fetchedData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // This would be customized per workflow
    // For now, pass through with basic structuring
    return {
      ...fetchedData,
      customer: {
        id: context.customerId,
        name: context.customerName,
        arr: context.customerARR,
        renewalDate: context.renewalDate,
        healthScore: context.healthScore,
      },
      processedAt: new Date().toISOString(),
    };
  }

  /**
   * Create workflow outputs (docs, sheets, etc.)
   */
  private async createOutputs(
    workflow: WorkflowDefinition,
    context: WorkflowContext,
    processedData: Record<string, unknown>
  ): Promise<Array<{ type: string; id: string; name: string; url: string }>> {
    const { userId, customerId, customerName } = context;
    const outputs: Array<{ type: string; id: string; name: string; url: string }> = [];

    // Get customer workspace
    const workspace = await customerWorkspaceService.getOrCreateWorkspace(
      customerId,
      customerName,
      userId
    );

    for (const outputDef of workflow.outputs) {
      try {
        // Replace variables in name
        let name = outputDef.name.replace('{customerName}', customerName);
        name = name.replace('{date}', new Date().toISOString().split('T')[0]);

        // Determine target folder
        const folderMap: Record<string, string> = {
          'reports': workspace.folders.success,
          'contracts': workspace.folders.onboarding,
          'meetings': workspace.folders.meetings,
          'qbrs': workspace.folders.qbrs,
          'onboarding': workspace.folders.onboarding,
          'health': workspace.folders.health,
          'risk': workspace.folders.risk,
          'renewals': workspace.folders.renewals,
          'success': workspace.folders.success,
        };
        const folderId = outputDef.folder
          ? folderMap[outputDef.folder] || workspace.folders.success
          : workspace.folders.success;

        switch (outputDef.type) {
          case 'sheet': {
            const sheet = await sheetsService.createSpreadsheet(userId, {
              title: name,
              folderId,
            });
            outputs.push({
              type: 'sheet',
              id: sheet.id,
              name,
              url: sheet.webViewLink || `https://docs.google.com/spreadsheets/d/${sheet.id}`,
            });
            break;
          }
          case 'doc': {
            const doc = await docsService.createDocument(userId, {
              title: name,
              folderId,
            });
            outputs.push({
              type: 'doc',
              id: doc.id,
              name,
              url: doc.webViewLink || `https://docs.google.com/document/d/${doc.id}`,
            });
            break;
          }
          case 'slide': {
            const presentation = await slidesService.createPresentation(userId, {
              title: name,
              folderId,
            });
            outputs.push({
              type: 'slide',
              id: presentation.id,
              name,
              url: presentation.webViewLink || `https://docs.google.com/presentation/d/${presentation.id}`,
            });
            break;
          }
          case 'folder': {
            const folder = await driveService.createFolder(userId, name, folderId);
            outputs.push({
              type: 'folder',
              id: folder.id,
              name,
              url: `https://drive.google.com/drive/folders/${folder.id}`,
            });
            break;
          }
        }
      } catch (error) {
        console.error(`Failed to create output ${outputDef.type}:`, error);
      }
    }

    return outputs;
  }

  /**
   * Build the workflow output for chat
   */
  private buildOutput(
    workflow: WorkflowDefinition,
    outputs: Array<{ type: string; id: string; name: string; url: string }>,
    processedData: Record<string, unknown>
  ): WorkflowOutput {
    const fileList = outputs.map(o => `- **${o.name}** (${o.type}): [View](${o.url})`).join('\n');

    return {
      files: outputs.map(o => ({
        type: o.type as 'doc' | 'sheet' | 'slide' | 'folder',
        id: o.id,
        name: o.name,
        url: o.url,
      })),
      summary: `I've completed the **${workflow.name}** workflow.\n\n**Created files:**\n${fileList}\n\n${workflow.approvalMessage || 'Please review and approve to continue.'}`,
      reviewData: processedData,
      actions: workflow.requiresApproval
        ? [
            { id: 'approve', label: 'Approve', type: 'approve' as const },
            { id: 'reject', label: 'Reject', type: 'reject' as const },
            { id: 'view', label: 'View Files', type: 'view' as const },
          ]
        : [{ id: 'view', label: 'View Files', type: 'view' as const }],
    };
  }

  /**
   * Update step status
   */
  private async updateStepStatus(
    execution: WorkflowExecution,
    stepType: string,
    status: WorkflowStatus,
    data?: Record<string, unknown>
  ): Promise<void> {
    const step = execution.steps.find(s => s.id.includes(stepType) || s.name.toLowerCase().includes(stepType));
    if (step) {
      step.status = status;
      step.data = data;
      if (status === 'completed') {
        step.completedAt = new Date();
      } else if (status !== 'pending') {
        step.startedAt = new Date();
      }
    }
    execution.updatedAt = new Date();
    executions.set(execution.id, execution);
    this.emit('step:update', { execution, step });
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return executions.get(executionId);
  }

  /**
   * Approve workflow execution
   */
  async approve(executionId: string, userId: string): Promise<WorkflowExecution> {
    const execution = executions.get(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }
    if (execution.status !== 'awaiting_review') {
      throw new Error('Execution not awaiting review');
    }

    execution.status = 'approved';
    execution.completedAt = new Date();
    execution.updatedAt = new Date();
    executions.set(executionId, execution);
    this.emit('execution:approved', execution);

    return execution;
  }

  /**
   * Reject workflow execution
   */
  async reject(executionId: string, userId: string, reason?: string): Promise<WorkflowExecution> {
    const execution = executions.get(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }
    if (execution.status !== 'awaiting_review') {
      throw new Error('Execution not awaiting review');
    }

    execution.status = 'rejected';
    execution.completedAt = new Date();
    execution.updatedAt = new Date();
    execution.error = reason;
    executions.set(executionId, execution);
    this.emit('execution:rejected', execution);

    return execution;
  }
}

export const workflowExecutor = new WorkflowExecutor();
