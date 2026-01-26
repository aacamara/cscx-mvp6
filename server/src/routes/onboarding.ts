/**
 * Onboarding Routes
 * Handles onboarding workspace creation: Drive folders + Sheets tracker
 */

import { Router, Request, Response } from 'express';
import { driveService, CustomerFolderStructure } from '../services/google/drive.js';
import { sheetsService } from '../services/google/sheets.js';
import { docsService } from '../services/google/docs.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const router = Router();

// Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// Types
interface ContractExtraction {
  company_name: string;
  arr: number;
  industry?: string;
  contract_period?: string;
  entitlements?: Array<{
    type?: string;
    description: string;
    quantity?: string | number;
  }>;
  stakeholders?: Array<{
    name: string;
    role: string;
    email?: string;
  }>;
}

interface CreateWorkspaceRequest {
  contractId?: string;
  customerName: string;
  contractData: ContractExtraction;
  originalDocument?: {
    fileName: string;
    mimeType: string;
    content: string; // base64
  };
}

interface CreateWorkspaceResponse {
  customerId: string;
  driveRootId: string;
  driveFolders: CustomerFolderStructure;
  sheetId: string;
  sheetUrl: string;
  contractFileId?: string;
}

/**
 * POST /api/onboarding/workspace
 * Creates Google Workspace structure for a new customer onboarding
 */
router.post('/workspace', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { contractId, customerName, contractData, originalDocument } = req.body as CreateWorkspaceRequest;

    if (!customerName || !contractData) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customerName', 'contractData']
      });
    }

    // 1. Create Drive folder structure
    console.log(`Creating Drive folder structure for ${customerName}...`);
    const driveFolders = await driveService.createCustomerFolderStructure(userId, customerName);

    // 2. Upload contract to Contracts folder (if provided)
    let contractFileId: string | undefined;
    if (originalDocument) {
      console.log(`Uploading contract to Drive...`);
      const contractFile = await driveService.uploadFile(userId, {
        name: originalDocument.fileName || `${customerName} - Contract.pdf`,
        mimeType: originalDocument.mimeType || 'application/pdf',
        content: Buffer.from(originalDocument.content, 'base64'),
        folderId: driveFolders.onboarding, // Contracts stored in onboarding folder
      });
      contractFileId = contractFile.id;
    }

    // 3. Create Onboarding Tracker spreadsheet
    console.log(`Creating Onboarding Tracker sheet...`);
    const tracker = await sheetsService.createFromTemplate(
      userId,
      'onboarding_tracker',
      `${customerName} - Onboarding Tracker`,
      driveFolders.onboarding
    );

    // 4. Populate the tracker with extracted data
    console.log(`Populating tracker with contract data...`);
    const today = new Date().toISOString().split('T')[0];
    const targetGoLive = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Add initial row to Onboarding sheet
    await sheetsService.appendRow(userId, tracker.id, {
      sheetName: 'Onboarding',
      values: [
        customerName,
        today, // Start Date
        targetGoLive, // Target Go-Live
        'Kickoff', // Current Phase
        '0%', // Progress
        'Healthy', // Health
        '', // Owner (CSM will fill)
        '', // Blockers
        'Schedule Kickoff Meeting', // Next Milestone
      ],
    });

    // Add initial milestones
    const milestones = [
      [customerName, 'Kickoff Meeting', getDateInDays(5), 'Pending', '', 'Schedule with key stakeholders'],
      [customerName, 'Technical Setup', getDateInDays(14), 'Pending', '', 'Configure integrations'],
      [customerName, 'Initial Training', getDateInDays(21), 'Pending', '', 'Train primary users'],
      [customerName, 'First Value Check', getDateInDays(30), 'Pending', '', 'Review progress'],
      [customerName, 'Go-Live', getDateInDays(60), 'Pending', '', 'Full deployment'],
      [customerName, 'QBR', getDateInDays(90), 'Pending', '', 'First quarterly review'],
    ];

    await sheetsService.appendRows(userId, tracker.id, 'Milestones', milestones);

    // Add initial tasks from stakeholders
    if (contractData.stakeholders && contractData.stakeholders.length > 0) {
      const tasks = contractData.stakeholders.map(stakeholder => [
        customerName,
        `Schedule intro with ${stakeholder.name}`,
        'CSM',
        getDateInDays(7),
        'High',
        'Pending',
        'Kickoff Meeting',
      ]);
      await sheetsService.appendRows(userId, tracker.id, 'Tasks', tasks);
    }

    // 5. Create customer record in database (if Supabase configured)
    let customerId: string | null = null;

    if (supabase) {
      try {
        // Check if customer with same name already exists
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('name', customerName)
          .maybeSingle();

        if (existing) {
          // Update existing customer
          customerId = existing.id;
          const { error: updateError } = await supabase
            .from('customers')
            .update({
              arr: contractData.arr || 0,
              industry: contractData.industry || null,
              stage: 'onboarding',
              health_score: 100,
              user_id: userId,
              drive_root_id: driveFolders.root,
              onboarding_sheet_id: tracker.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('Error updating customer:', updateError);
          }
        } else {
          // Create new customer (let Supabase generate UUID)
          const { data: customer, error: customerError } = await supabase
            .from('customers')
            .insert({
              name: customerName,
              arr: contractData.arr || 0,
              industry: contractData.industry || null,
              stage: 'onboarding',
              health_score: 100,
              user_id: userId,
              drive_root_id: driveFolders.root,
              onboarding_sheet_id: tracker.id,
            })
            .select('id')
            .single();

          if (customerError) {
            console.error('Error creating customer:', customerError);
          } else if (customer) {
            customerId = customer.id;
          }
        }

        // Update contract record if contractId provided and customer was created
        if (contractId && customerId) {
          await supabase
            .from('contracts')
            .update({
              customer_id: customerId,
              drive_folder_id: driveFolders.onboarding, // Contracts in onboarding folder
              drive_file_id: contractFileId,
              tracker_sheet_id: tracker.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', contractId);
        }

        // Save folder structure to customer_workspace_folders
        if (customerId) {
          await (supabase as any).from('customer_workspace_folders').upsert({
            customer_id: customerId,
            // Note: user_id omitted - requires auth.users entry
            root_folder_id: driveFolders.root,
            root_folder_url: driveFolders.rootUrl,
            templates_folder_id: driveFolders.templates,
            onboarding_folder_id: driveFolders.onboarding,
            meetings_folder_id: driveFolders.meetings,
            meetings_notes_folder_id: driveFolders.meetingNotes,
            meetings_transcripts_folder_id: driveFolders.transcripts,
            meetings_recordings_folder_id: driveFolders.recordings,
            qbrs_folder_id: driveFolders.qbrs,
            health_folder_id: driveFolders.health,
            success_folder_id: driveFolders.success,
            renewals_folder_id: driveFolders.renewals,
            risk_folder_id: driveFolders.risk,
          }, {
            onConflict: 'customer_id',
          });
          console.log(`Saved folder structure for ${customerName}`);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Continue without database - workspace is still created
      }
    }

    // Generate fallback ID if database creation failed
    if (!customerId) {
      customerId = `local_${customerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${Date.now()}`;
    }

    // Return workspace details
    const response: CreateWorkspaceResponse = {
      customerId,
      driveRootId: driveFolders.root,
      driveFolders,
      sheetId: tracker.id,
      sheetUrl: tracker.webViewLink || `https://docs.google.com/spreadsheets/d/${tracker.id}/edit`,
      contractFileId,
    };

    console.log(`Workspace created successfully for ${customerName}`);
    res.json(response);

  } catch (error) {
    console.error('Error creating onboarding workspace:', error);
    res.status(500).json({
      error: 'Failed to create onboarding workspace',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/onboarding/workspace/:customerId
 * Get workspace details for a customer
 */
router.get('/workspace/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { customerId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('user_id', userId)
      .single();

    if (error || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      customerId: customer.id,
      customerName: customer.name,
      driveRootId: customer.drive_root_id,
      sheetId: customer.onboarding_sheet_id,
      sheetUrl: customer.onboarding_sheet_id
        ? `https://docs.google.com/spreadsheets/d/${customer.onboarding_sheet_id}/edit`
        : null,
      status: customer.status,
    });

  } catch (error) {
    console.error('Error getting workspace:', error);
    res.status(500).json({
      error: 'Failed to get workspace',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/onboarding/documents/create
 * Create core documents for a customer with existing workspace
 */
router.post('/documents/create', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId, customerName, folderId, folderStructure } = req.body;
    if (!customerName || !folderId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customerName', 'folderId']
      });
    }

    const documents: Array<{ type: string; id: string; url: string; name: string }> = [];
    const errors: Array<{ type: string; error: string }> = [];

    // 1. Entitlements Sheet
    try {
      const entitlements = await sheetsService.createSpreadsheet(userId, {
        title: `${customerName} - Entitlements`,
        folderId: folderStructure?.onboarding || folderId,
      });
      // Add headers
      await sheetsService.updateValues(userId, entitlements.id, {
        range: 'Sheet1!A1:E1',
        values: [['Entitlement Type', 'Description', 'Quantity', 'Status', 'Notes']],
      });
      documents.push({
        type: 'entitlements',
        id: entitlements.id,
        url: entitlements.webViewLink || '',
        name: `${customerName} - Entitlements`,
      });
    } catch (e) {
      errors.push({ type: 'entitlements', error: (e as Error).message });
    }

    // 2. Stakeholder Map
    try {
      const stakeholders = await sheetsService.createSpreadsheet(userId, {
        title: `${customerName} - Stakeholder Map`,
        folderId: folderStructure?.onboarding || folderId,
      });
      await sheetsService.updateValues(userId, stakeholders.id, {
        range: 'Sheet1!A1:G1',
        values: [['Name', 'Title', 'Email', 'Role', 'Influence', 'Sentiment', 'Notes']],
      });
      documents.push({
        type: 'stakeholder_map',
        id: stakeholders.id,
        url: stakeholders.webViewLink || '',
        name: `${customerName} - Stakeholder Map`,
      });
    } catch (e) {
      errors.push({ type: 'stakeholder_map', error: (e as Error).message });
    }

    // 3. Health Tracker
    try {
      const health = await sheetsService.createSpreadsheet(userId, {
        title: `${customerName} - Health Tracker`,
        folderId: folderStructure?.health || folderId,
      });
      await sheetsService.updateValues(userId, health.id, {
        range: 'Sheet1!A1:H1',
        values: [['Date', 'Health Score', 'Usage Score', 'Engagement Score', 'Support Score', 'NPS', 'Risk Level', 'Notes']],
      });
      documents.push({
        type: 'health_tracker',
        id: health.id,
        url: health.webViewLink || '',
        name: `${customerName} - Health Tracker`,
      });
    } catch (e) {
      errors.push({ type: 'health_tracker', error: (e as Error).message });
    }

    // 4. Usage Metrics Sheet
    try {
      const usage = await sheetsService.createSpreadsheet(userId, {
        title: `${customerName} - Usage Metrics`,
        folderId: folderStructure?.health || folderId,
      });
      await sheetsService.updateValues(userId, usage.id, {
        range: 'Sheet1!A1:I1',
        values: [['Date', 'DAU', 'WAU', 'MAU', 'Login Count', 'API Calls', 'Session Avg (min)', 'Feature Adoption %', 'Notes']],
      });
      documents.push({
        type: 'usage_metrics',
        id: usage.id,
        url: usage.webViewLink || '',
        name: `${customerName} - Usage Metrics`,
      });
    } catch (e) {
      errors.push({ type: 'usage_metrics', error: (e as Error).message });
    }

    // 5. Success Plan Doc
    try {
      const successPlan = await docsService.createDocument(userId, {
        title: `${customerName} - Success Plan`,
        folderId: folderStructure?.success || folderId,
        content: `# ${customerName} Success Plan\n\n## Objectives\n1. \n2. \n3. \n\n## Key Milestones\n- \n\n## Success Metrics\n- \n\n## Stakeholders\n- \n\n## Timeline\n- \n`,
      });
      documents.push({
        type: 'success_plan',
        id: successPlan.id,
        url: successPlan.webViewLink || '',
        name: `${customerName} - Success Plan`,
      });
    } catch (e) {
      errors.push({ type: 'success_plan', error: (e as Error).message });
    }

    // 6. Renewal Tracker
    try {
      const renewal = await sheetsService.createSpreadsheet(userId, {
        title: `${customerName} - Renewal Tracker`,
        folderId: folderStructure?.renewals || folderId,
      });
      await sheetsService.updateValues(userId, renewal.id, {
        range: 'Sheet1!A1:J1',
        values: [['Renewal Date', 'Current ARR', 'Proposed ARR', 'Probability %', 'Stage', 'Champion Engaged', 'Exec Sponsor', 'QBR Done', 'Proposal Sent', 'Notes']],
      });
      documents.push({
        type: 'renewal_tracker',
        id: renewal.id,
        url: renewal.webViewLink || '',
        name: `${customerName} - Renewal Tracker`,
      });
    } catch (e) {
      errors.push({ type: 'renewal_tracker', error: (e as Error).message });
    }

    // Save to database if Supabase configured
    if (supabase && customerId) {
      for (const doc of documents) {
        try {
          await (supabase as any).from('customer_documents').upsert({
            customer_id: customerId,
            user_id: userId,
            document_type: doc.type,
            google_file_id: doc.id,
            name: doc.name,
            file_type: doc.type.includes('tracker') || doc.type.includes('metrics') || doc.type.includes('map') || doc.type === 'entitlements' ? 'sheet' : 'doc',
            status: 'active',
            web_view_url: doc.url,
            web_edit_url: doc.url,
          }, {
            onConflict: 'customer_id,document_type,period',
          });
        } catch (dbError) {
          console.error(`Failed to save ${doc.type} to database:`, dbError);
        }
      }
    }

    console.log(`Created ${documents.length} documents for ${customerName}`);

    res.json({
      success: true,
      documentsCreated: documents.length,
      documents,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error creating documents:', error);
    res.status(500).json({
      error: 'Failed to create documents',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/onboarding/tasks/:customerId
 * Get plan tasks and their completion status for a customer
 */
router.get('/tasks/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { customerId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.json({ tasks: [], completedTaskIds: [] });
    }

    // Get tasks from plan_tasks table
    const { data: tasks, error } = await supabase
      .from('plan_tasks')
      .select('*')
      .eq('customer_id', customerId)
      .order('phase_index', { ascending: true })
      .order('task_index', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      return res.json({ tasks: [], completedTaskIds: [] });
    }

    // Get completed task IDs
    const completedTaskIds = (tasks || [])
      .filter(t => t.status === 'completed')
      .map(t => `${t.phase_index}-${t.task_index}`);

    res.json({
      tasks: tasks || [],
      completedTaskIds
    });

  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({
      error: 'Failed to get tasks',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/onboarding/tasks/:customerId
 * Save or update plan tasks for a customer
 */
router.post('/tasks/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { customerId } = req.params;
    const { tasks } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.json({ success: true, message: 'Database not configured' });
    }

    // Upsert all tasks
    for (const task of tasks) {
      await supabase
        .from('plan_tasks')
        .upsert({
          customer_id: customerId,
          user_id: userId,
          phase_index: task.phaseIndex,
          task_index: task.taskIndex,
          phase_name: task.phaseName,
          task_title: task.title,
          task_description: task.description,
          owner: task.owner,
          status: task.status || 'pending',
          due_date: task.dueDate,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'customer_id,phase_index,task_index'
        });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error saving tasks:', error);
    res.status(500).json({
      error: 'Failed to save tasks',
      message: (error as Error).message,
    });
  }
});

/**
 * PATCH /api/onboarding/tasks/:customerId/:phaseIndex/:taskIndex
 * Update a specific task's status
 */
router.patch('/tasks/:customerId/:phaseIndex/:taskIndex', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { customerId, phaseIndex, taskIndex } = req.params;
    const { status, completedAt } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.json({ success: true, message: 'Database not configured, update stored locally' });
    }

    // Update the task status
    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed') {
      updates.completed_at = completedAt || new Date().toISOString();
    } else {
      updates.completed_at = null;
    }

    const { error } = await supabase
      .from('plan_tasks')
      .update(updates)
      .eq('customer_id', customerId)
      .eq('phase_index', parseInt(phaseIndex))
      .eq('task_index', parseInt(taskIndex));

    if (error) {
      // If task doesn't exist, create it
      if (error.code === 'PGRST116') {
        await supabase
          .from('plan_tasks')
          .insert({
            customer_id: customerId,
            user_id: userId,
            phase_index: parseInt(phaseIndex),
            task_index: parseInt(taskIndex),
            status,
            completed_at: status === 'completed' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          });
      } else {
        throw error;
      }
    }

    res.json({ success: true, status });

  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      error: 'Failed to update task',
      message: (error as Error).message,
    });
  }
});

// Helper functions
function getDateInDays(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
}

export default router;
