/**
 * Workflow API Routes
 *
 * Exposes the agent workflow service to the frontend.
 * Enables agents to execute multi-step Google Workspace operations.
 */

import { Router, Request, Response } from 'express';
import {
  agentWorkflowService,
  executeFromAction,
  AGENT_WORKFLOWS,
  ALL_WORKFLOWS,
  ACTION_TO_WORKFLOW,
} from '../services/agentWorkflows/index.js';
import { executeAction, type ActionContext } from '../services/agentWorkflows/actionExecutor.js';
import type { WorkflowContext, WorkflowId } from '../services/agentWorkflows/types.js';
import type { CSAgentType } from '../services/google/agentActions.js';

// Type definitions for external API responses
interface AnalysisResult {
  success?: boolean;
  summary?: string;
  insights?: unknown[];
  outputSheetUrl?: string;
  outputSheetId?: string;
  riskLevel?: string;
}

interface QBRResult {
  presentationId?: string;
  webViewLink?: string;
}

interface InsightsResult {
  insights?: {
    summary?: string;
    risks?: unknown[];
    opportunities?: unknown[];
    actions?: unknown[];
    healthTrend?: string;
  };
}

const router = Router();

// ============================================
// HELPER: Transform action output to include driveLinks
// Converts various URL fields to standardized driveLinks array
// ============================================
function transformOutputToDriveLinks(output: Record<string, unknown>): Record<string, unknown> {
  const driveLinks: Array<{ type: string; name: string; webViewLink: string; id: string }> = [];

  // Map of URL field patterns to link types
  const urlMappings: Array<{ urlKey: string; idKey: string; type: string; namePrefix: string }> = [
    { urlKey: 'folderUrl', idKey: 'folderId', type: 'folder', namePrefix: 'Workspace Folder' },
    { urlKey: 'sheetUrl', idKey: 'sheetId', type: 'sheet', namePrefix: 'Sheet' },
    { urlKey: 'documentUrl', idKey: 'documentId', type: 'doc', namePrefix: 'Document' },
    { urlKey: 'presentationUrl', idKey: 'presentationId', type: 'slide', namePrefix: 'Presentation' },
    { urlKey: 'slidesUrl', idKey: 'slidesId', type: 'slide', namePrefix: 'Slides' },
    { urlKey: 'notesUrl', idKey: 'notesId', type: 'doc', namePrefix: 'Notes' },
    { urlKey: 'deckUrl', idKey: 'deckId', type: 'slide', namePrefix: 'Deck' },
    { urlKey: 'meetingUrl', idKey: 'meetingId', type: 'calendar', namePrefix: 'Meeting' },
    { urlKey: 'appsScriptUrl', idKey: 'appsScriptId', type: 'doc', namePrefix: 'Apps Script' },
    { urlKey: 'alertScriptUrl', idKey: 'alertScriptId', type: 'doc', namePrefix: 'Alert Script' },
    { urlKey: 'scriptsUrl', idKey: 'scriptsId', type: 'doc', namePrefix: 'Automation Scripts' },
  ];

  for (const mapping of urlMappings) {
    const url = output[mapping.urlKey];
    const id = output[mapping.idKey];
    if (typeof url === 'string' && url) {
      driveLinks.push({
        type: mapping.type,
        name: mapping.namePrefix,
        webViewLink: url,
        id: typeof id === 'string' ? id : '',
      });
    }
  }

  // Return original output with driveLinks added
  return {
    ...output,
    driveLinks: driveLinks.length > 0 ? driveLinks : undefined,
  };
}

// ============================================
// GET /api/workflows
// List all workflows for an agent
// ============================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { agentType } = req.query;

    if (agentType) {
      const workflows = agentWorkflowService.getAgentWorkflowMetadata(agentType as CSAgentType);
      return res.json({ workflows, agentType });
    }

    // Return all workflows grouped by agent
    const allWorkflows = Object.entries(AGENT_WORKFLOWS).map(([agent, workflowIds]) => ({
      agentType: agent,
      workflows: workflowIds.map(id => {
        const w = ALL_WORKFLOWS[id];
        return w ? { id: w.id, name: w.name, description: w.description, category: w.category } : null;
      }).filter(Boolean),
    }));

    res.json({ agents: allWorkflows });
  } catch (error) {
    console.error('List workflows error:', error);
    res.status(500).json({ error: 'Failed to list workflows' });
  }
});

// ============================================
// GET /api/workflows/:workflowId
// Get workflow details
// ============================================
router.get('/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const metadata = agentWorkflowService.getWorkflowMetadata(workflowId as WorkflowId);

    if (!metadata) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(metadata);
  } catch (error) {
    console.error('Get workflow error:', error);
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

// ============================================
// POST /api/workflows/execute
// Execute a workflow
// ============================================
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { workflowId, userId, agentType, customerId, customerName, customerARR, renewalDate, healthScore, input } = req.body;

    if (!workflowId || !userId || !agentType || !customerId || !customerName) {
      return res.status(400).json({
        error: 'Missing required fields: workflowId, userId, agentType, customerId, customerName',
      });
    }

    const context: WorkflowContext = {
      userId,
      agentType,
      customerId,
      customerName,
      customerARR,
      renewalDate,
      healthScore,
    };

    const execution = await agentWorkflowService.executeWorkflow(
      workflowId as WorkflowId,
      context,
      input || {}
    );

    res.json({
      success: true,
      execution: {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        steps: execution.steps,
        output: execution.output,
        createdAt: execution.createdAt,
      },
    });
  } catch (error) {
    console.error('Execute workflow error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to execute workflow' });
  }
});

// ============================================
// POST /api/workflows/execute-action
// Execute workflow from a quick action ID
// ============================================
router.post('/execute-action', async (req: Request, res: Response) => {
  try {
    const { actionId, userId, agentType, customerId, customerName, customerARR, renewalDate, healthScore, input, useAIEnhancement = true } = req.body;

    if (!actionId || !userId || !agentType || !customerId || !customerName) {
      return res.status(400).json({
        error: 'Missing required fields: actionId, userId, agentType, customerId, customerName',
      });
    }

    // ============================================
    // PRIMARY ACTION EXECUTOR
    // Uses the comprehensive action executor for most actions
    // ============================================

    const actionCtx: ActionContext = {
      userId,
      customerId,
      customerName,
      customerARR,
      healthScore,
      renewalDate,
      useAIEnhancement, // Pass AI enhancement flag
    };

    // Try the new action executor first (handles 14 actions with real Google services)
    const actionResult = await executeAction(actionId, actionCtx);
    if (actionResult) {
      // Transform output to include driveLinks for frontend display
      const transformedOutput = transformOutputToDriveLinks(actionResult.output);
      return res.json({
        success: actionResult.success,
        hasWorkflow: true,
        execution: {
          id: `action_${Date.now()}`,
          workflowId: actionResult.workflowId,
          status: actionResult.status,
          steps: actionResult.steps,
          output: transformedOutput,
          error: actionResult.error,
          createdAt: new Date().toISOString(),
        },
      });
    }

    // ============================================
    // SPECIAL HANDLERS FOR ANALYSIS-BASED ACTIONS
    // These use the agent-analysis service for AI-powered analysis
    // ============================================

    // Adoption: usage_analysis → agent-analysis service (database-backed)
    if (actionId === 'usage_analysis') {
      try {
        const analysisResponse = await fetch(`http://localhost:3001/api/agent-analysis/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            customerId,
            customerName,
            analysisType: 'usage',
            outputFormat: 'sheet',
          }),
        });

        const analysisResult = await analysisResponse.json() as AnalysisResult;

        if (analysisResult.success) {
          const rawOutput = {
            summary: analysisResult.summary || 'Usage analysis complete',
            insights: analysisResult.insights || [],
            sheetUrl: analysisResult.outputSheetUrl,
            sheetId: analysisResult.outputSheetId,
          };
          return res.json({
            success: true,
            hasWorkflow: true,
            execution: {
              id: `direct_${Date.now()}`,
              workflowId: 'analyze_usage_metrics',
              status: 'completed',
              steps: [
                { id: 'fetch', name: 'Pulling Usage Data', status: 'completed' },
                { id: 'process', name: 'Analyzing Patterns', status: 'completed' },
                { id: 'create', name: 'Creating Report', status: 'completed' },
                { id: 'notify', name: 'Ready for Review', status: 'completed' },
              ],
              output: transformOutputToDriveLinks(rawOutput),
              createdAt: new Date().toISOString(),
            },
          });
        }
      } catch (analysisError) {
        console.error('Usage analysis service error:', analysisError);
        // Fall through to generic workflow
      }
    }

    // Strategic: qbr_prep → QBR slides service
    if (actionId === 'qbr_prep') {
      try {
        const qbrResponse = await fetch(`http://localhost:3001/api/metrics/qbr/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            customerId,
            customerName,
            metrics: {
              healthScore: healthScore || 70,
              arr: customerARR || 0,
            },
          }),
        });

        const qbrResult = await qbrResponse.json() as QBRResult;

        if (qbrResult.presentationId) {
          const rawOutput = {
            summary: 'QBR presentation generated successfully',
            presentationUrl: qbrResult.webViewLink,
            presentationId: qbrResult.presentationId,
          };
          return res.json({
            success: true,
            hasWorkflow: true,
            execution: {
              id: `direct_${Date.now()}`,
              workflowId: 'create_qbr_package',
              status: 'completed',
              steps: [
                { id: 'fetch', name: 'Pulling Historical Data', status: 'completed' },
                { id: 'process', name: 'Analyzing Metrics', status: 'completed' },
                { id: 'create', name: 'Building QBR Package', status: 'completed' },
                { id: 'notify', name: 'Ready for Review', status: 'completed' },
              ],
              output: transformOutputToDriveLinks(rawOutput),
              createdAt: new Date().toISOString(),
            },
          });
        }
      } catch (qbrError) {
        console.error('QBR generation service error:', qbrError);
        // Fall through to generic workflow
      }
    }

    // Risk: risk_assessment & health_check → agent-analysis service
    if (actionId === 'risk_assessment' || actionId === 'health_check') {
      try {
        const analysisResponse = await fetch(`http://localhost:3001/api/agent-analysis/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            customerId,
            customerName,
            analysisType: 'health',
            outputFormat: 'sheet',
          }),
        });

        const analysisResult = await analysisResponse.json() as AnalysisResult;

        if (analysisResult.success) {
          const rawOutput = {
            summary: analysisResult.summary || 'Health assessment complete',
            insights: analysisResult.insights || [],
            sheetUrl: analysisResult.outputSheetUrl,
            sheetId: analysisResult.outputSheetId,
            riskLevel: analysisResult.riskLevel || 'medium',
          };
          return res.json({
            success: true,
            hasWorkflow: true,
            execution: {
              id: `direct_${Date.now()}`,
              workflowId: actionId === 'risk_assessment' ? 'run_health_assessment' : 'analyze_churn_signals',
              status: 'completed',
              steps: [
                { id: 'fetch', name: 'Gathering Health Data', status: 'completed' },
                { id: 'process', name: 'Analyzing Risk Signals', status: 'completed' },
                { id: 'create', name: 'Creating Assessment', status: 'completed' },
                { id: 'notify', name: 'Ready for Review', status: 'completed' },
              ],
              output: transformOutputToDriveLinks(rawOutput),
              createdAt: new Date().toISOString(),
            },
          });
        }
      } catch (riskError) {
        console.error('Risk analysis service error:', riskError);
        // Fall through to generic workflow
      }
    }

    // Renewal: renewal_forecast & value_summary → agent-analysis insights
    if (actionId === 'renewal_forecast' || actionId === 'value_summary') {
      try {
        const insightsResponse = await fetch(`http://localhost:3001/api/agent-analysis/insights`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            customerId,
            context: actionId === 'renewal_forecast'
              ? 'Focus on renewal likelihood, risks, and recommended actions'
              : 'Focus on ROI, value delivered, and business impact metrics',
          }),
        });

        const insightsResult = await insightsResponse.json() as InsightsResult;

        if (insightsResult.insights) {
          return res.json({
            success: true,
            hasWorkflow: true,
            execution: {
              id: `direct_${Date.now()}`,
              workflowId: actionId === 'renewal_forecast' ? 'generate_renewal_forecast' : 'build_value_summary',
              status: 'completed',
              steps: [
                { id: 'fetch', name: 'Gathering Data', status: 'completed' },
                { id: 'process', name: 'Analyzing', status: 'completed' },
                { id: 'create', name: 'Creating Report', status: 'completed' },
                { id: 'notify', name: 'Ready for Review', status: 'completed' },
              ],
              output: {
                summary: insightsResult.insights.summary || 'Analysis complete',
                risks: insightsResult.insights.risks || [],
                opportunities: insightsResult.insights.opportunities || [],
                actions: insightsResult.insights.actions || [],
                healthTrend: insightsResult.insights.healthTrend || 'stable',
              },
              createdAt: new Date().toISOString(),
            },
          });
        }
      } catch (insightsError) {
        console.error('Insights service error:', insightsError);
        // Fall through to generic workflow
      }
    }

    // ============================================
    // GENERIC WORKFLOW EXECUTION
    // ============================================

    // Check if action maps to a workflow
    const workflowId = ACTION_TO_WORKFLOW[actionId];
    if (!workflowId) {
      return res.json({
        success: false,
        hasWorkflow: false,
        message: `No workflow available for action: ${actionId}`,
      });
    }

    const context: WorkflowContext = {
      userId,
      agentType,
      customerId,
      customerName,
      customerARR,
      renewalDate,
      healthScore,
    };

    const execution = await executeFromAction(actionId, context, input || {});

    if (!execution) {
      return res.json({
        success: false,
        hasWorkflow: false,
        message: 'Workflow execution failed',
      });
    }

    res.json({
      success: true,
      hasWorkflow: true,
      execution: {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        steps: execution.steps,
        output: execution.output,
        createdAt: execution.createdAt,
      },
    });
  } catch (error) {
    console.error('Execute action workflow error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to execute workflow' });
  }
});

// ============================================
// GET /api/workflows/execution/:executionId
// Get execution status
// ============================================
router.get('/execution/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const execution = agentWorkflowService.getExecution(executionId);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json({
      execution: {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        steps: execution.steps,
        output: execution.output,
        createdAt: execution.createdAt,
        updatedAt: execution.updatedAt,
        completedAt: execution.completedAt,
        error: execution.error,
      },
    });
  } catch (error) {
    console.error('Get execution error:', error);
    res.status(500).json({ error: 'Failed to get execution status' });
  }
});

// ============================================
// POST /api/workflows/execution/:executionId/approve
// Approve workflow execution
// ============================================
router.post('/execution/:executionId/approve', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const execution = await agentWorkflowService.approveExecution(executionId, userId);

    res.json({
      success: true,
      execution: {
        id: execution.id,
        status: execution.status,
        completedAt: execution.completedAt,
      },
    });
  } catch (error) {
    console.error('Approve execution error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to approve execution' });
  }
});

// ============================================
// POST /api/workflows/execution/:executionId/reject
// Reject workflow execution
// ============================================
router.post('/execution/:executionId/reject', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const execution = await agentWorkflowService.rejectExecution(executionId, userId, reason);

    res.json({
      success: true,
      execution: {
        id: execution.id,
        status: execution.status,
        completedAt: execution.completedAt,
        error: execution.error,
      },
    });
  } catch (error) {
    console.error('Reject execution error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to reject execution' });
  }
});

// ============================================
// GET /api/workflows/actions/mapping
// Get action-to-workflow mapping (for frontend)
// ============================================
router.get('/actions/mapping', async (req: Request, res: Response) => {
  try {
    const mapping = Object.entries(ACTION_TO_WORKFLOW).map(([actionId, workflowId]) => {
      const workflow = ALL_WORKFLOWS[workflowId];
      return {
        actionId,
        workflowId,
        workflowName: workflow?.name,
        workflowDescription: workflow?.description,
        requiresApproval: workflow?.requiresApproval,
      };
    });

    res.json({ mapping });
  } catch (error) {
    console.error('Get action mapping error:', error);
    res.status(500).json({ error: 'Failed to get action mapping' });
  }
});

export default router;
