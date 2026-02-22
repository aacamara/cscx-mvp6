/**
 * File Upload Routes
 * Handles CSV file uploads for churn analysis (PRD-001)
 *
 * Endpoints:
 * - POST /api/upload/csv - Upload and parse CSV file
 * - POST /api/analysis/churn-risk - Analyze data for churn risk
 * - POST /api/emails/bulk-draft - Generate multiple draft emails
 * - POST /api/approvals/bulk - Approve multiple actions at once
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { csvParser } from '../services/fileUpload/csvParser.js';
import { churnScoringService, ChurnRiskScore } from '../services/analysis/churnScoring.js';
import { dataAnalystAgent, RescueEmail } from '../agents/specialists/dataAnalyst.js';
import { approvalService } from '../services/approval.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV files
    if (file.mimetype === 'text/csv' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Supabase client
let supabase: ReturnType<typeof createClient> | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// In-memory storage for files (fallback when Supabase not configured)
const inMemoryFiles: Map<string, {
  content: Buffer;
  fileName: string;
  userId: string;
  mapping?: Record<string, string>;
  analysisResult?: any;
}> = new Map();

/**
 * POST /api/upload/csv
 * Upload and parse a CSV file
 */
router.post('/csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📄 Processing CSV upload: ${req.file.originalname} (${req.file.size} bytes)`);

    // Use the Data Analyst agent to parse
    const result = await dataAnalystAgent.execute({
      action: 'parse_csv',
      userId,
      csvContent: req.file.buffer,
      fileName: req.file.originalname,
      customerId: req.body.customerId
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Store in memory for later use (when no Supabase)
    if (result.fileId && !supabase) {
      inMemoryFiles.set(result.fileId, {
        content: req.file.buffer,
        fileName: req.file.originalname,
        userId
      });
    }

    res.json({
      success: true,
      fileId: result.fileId,
      fileName: req.file.originalname,
      ...result.parsedData
    });

  } catch (error) {
    console.error('CSV upload error:', error);
    res.status(500).json({
      error: 'Failed to process CSV file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/upload/csv/:fileId/mapping
 * Confirm or update column mapping for an uploaded file
 */
router.post('/csv/:fileId/mapping', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId } = req.params;
    const { columnMapping } = req.body;

    if (!columnMapping) {
      return res.status(400).json({ error: 'Column mapping required' });
    }

    // Validate the mapping
    const validation = csvParser.validateMapping(columnMapping);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid column mapping',
        missing: validation.missing
      });
    }

    // Update mapping
    if (supabase) {
      await csvParser.updateColumnMapping(fileId, columnMapping);
    } else {
      const file = inMemoryFiles.get(fileId);
      if (file) {
        file.mapping = columnMapping;
      }
    }

    res.json({
      success: true,
      message: 'Column mapping confirmed',
      fileId
    });

  } catch (error) {
    console.error('Mapping update error:', error);
    res.status(500).json({
      error: 'Failed to update column mapping',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/upload/csv/:fileId
 * Get uploaded file details
 */
router.get('/csv/:fileId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId } = req.params;

    if (supabase) {
      const file = await csvParser.getUploadedFile(fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json({
        success: true,
        file
      });
    } else {
      const file = inMemoryFiles.get(fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json({
        success: true,
        file: {
          id: fileId,
          fileName: file.fileName,
          userId: file.userId,
          mapping: file.mapping
        }
      });
    }

  } catch (error) {
    console.error('File fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;


/**
 * Analysis Routes
 * Separate router for churn analysis endpoints
 */
export const analysisRouter = Router();

/**
 * POST /api/analysis/churn-risk
 * Analyze uploaded CSV for churn risk
 */
analysisRouter.post('/churn-risk', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId, columnMapping } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'File ID required' });
    }

    if (!columnMapping) {
      return res.status(400).json({ error: 'Column mapping required' });
    }

    console.log(`📊 Running churn analysis on file ${fileId}`);

    // Get file content
    let rows: Record<string, any>[];

    if (supabase) {
      const file = await csvParser.getUploadedFile(fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      // Re-parse for full data
      rows = file.previewData; // Use preview for demo, would need full content in production
    } else {
      const file = inMemoryFiles.get(fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      const parsed = await csvParser.parseCSV(file.content);
      rows = parsed.rows;

      // Store mapping
      file.mapping = columnMapping;
    }

    // Run churn analysis
    const analysisResult = await churnScoringService.analyzeCSVData(
      fileId,
      rows,
      columnMapping
    );

    // Store analysis result
    if (!supabase) {
      const file = inMemoryFiles.get(fileId);
      if (file) {
        file.analysisResult = analysisResult;
      }
    }

    // Generate summary
    const highRisk = analysisResult.summary.highRisk + analysisResult.summary.criticalRisk;

    res.json({
      success: true,
      fileId,
      summary: {
        totalRecords: analysisResult.totalRecords,
        analyzedRecords: analysisResult.analyzedRecords,
        ...analysisResult.summary
      },
      patterns: analysisResult.patterns,
      highRiskAccounts: analysisResult.scores
        .filter(s => s.riskLevel === 'high' || s.riskLevel === 'critical')
        .map(s => ({
          customerName: s.customerName,
          customerEmail: s.customerEmail,
          riskScore: s.riskScore,
          riskLevel: s.riskLevel,
          primaryConcerns: s.primaryConcerns
        })),
      message: highRisk > 0
        ? `Found ${highRisk} high-risk accounts. Would you like to draft rescue emails?`
        : 'No high-risk accounts found.'
    });

  } catch (error) {
    console.error('Churn analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze churn risk',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analysis/churn-risk/:fileId/summary
 * Get churn risk summary for a file
 */
analysisRouter.get('/churn-risk/:fileId/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId } = req.params;

    if (supabase) {
      const summary = await churnScoringService.getRiskSummary(fileId);
      if (!summary) {
        return res.status(404).json({ error: 'No analysis found for this file' });
      }
      res.json({ success: true, summary });
    } else {
      const file = inMemoryFiles.get(fileId);
      if (!file || !file.analysisResult) {
        return res.status(404).json({ error: 'No analysis found for this file' });
      }
      res.json({ success: true, summary: file.analysisResult.summary });
    }

  } catch (error) {
    console.error('Summary fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analysis/churn-risk/:fileId/high-risk
 * Get high-risk accounts for a file
 */
analysisRouter.get('/churn-risk/:fileId/high-risk', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId } = req.params;
    const threshold = parseInt(req.query.threshold as string) || 70;

    if (supabase) {
      const accounts = await churnScoringService.getHighRiskAccounts(fileId, threshold);
      res.json({ success: true, accounts });
    } else {
      const file = inMemoryFiles.get(fileId);
      if (!file || !file.analysisResult) {
        return res.status(404).json({ error: 'No analysis found for this file' });
      }
      const accounts = file.analysisResult.scores.filter(
        (s: ChurnRiskScore) => s.riskScore >= threshold
      );
      res.json({ success: true, accounts });
    }

  } catch (error) {
    console.error('High-risk fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch high-risk accounts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


/**
 * Bulk Email Routes
 * Separate router for bulk email operations
 */
export const bulkEmailRouter = Router();

/**
 * POST /api/emails/bulk-draft
 * Generate draft emails for high-risk accounts
 */
bulkEmailRouter.post('/bulk-draft', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId, riskThreshold = 70, columnMapping } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'File ID required' });
    }

    console.log(`📧 Generating rescue emails for file ${fileId} (threshold: ${riskThreshold})`);

    // Get high-risk accounts
    let highRiskAccounts: ChurnRiskScore[];

    if (supabase) {
      highRiskAccounts = await churnScoringService.getHighRiskAccounts(fileId, riskThreshold);
    } else {
      const file = inMemoryFiles.get(fileId);
      if (!file || !file.analysisResult) {
        return res.status(404).json({ error: 'No analysis found. Run churn analysis first.' });
      }
      highRiskAccounts = file.analysisResult.scores.filter(
        (s: ChurnRiskScore) => s.riskScore >= riskThreshold
      );
    }

    if (highRiskAccounts.length === 0) {
      return res.json({
        success: true,
        emails: [],
        message: `No accounts found with risk score >= ${riskThreshold}`
      });
    }

    // Use Data Analyst agent to draft emails
    const result = await dataAnalystAgent.execute({
      action: 'draft_rescue_emails',
      userId,
      fileId,
      riskThreshold
    });

    if (!result.success) {
      // Fall back to simpler email generation
      const emails = highRiskAccounts.map(account => ({
        customerName: account.customerName,
        customerEmail: account.customerEmail,
        riskScore: account.riskScore,
        riskLevel: account.riskLevel,
        primaryConcern: account.primaryConcerns[0] || 'Declining engagement',
        subject: `Let's reconnect, ${account.customerName}`,
        bodyHtml: generateFallbackEmailBody(account),
        bodyText: generateFallbackEmailBody(account, false)
      }));

      return res.json({
        success: true,
        emails,
        count: emails.length,
        message: `Generated ${emails.length} rescue email drafts`
      });
    }

    res.json({
      success: true,
      emails: result.draftEmails,
      count: result.draftEmails?.length || 0,
      message: result.summary
    });

  } catch (error) {
    console.error('Bulk email draft error:', error);
    res.status(500).json({
      error: 'Failed to generate email drafts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/emails/bulk-draft/:fileId/edit
 * Edit a draft email
 */
bulkEmailRouter.post('/bulk-draft/:fileId/edit', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { emailId, subject, bodyHtml, bodyText } = req.body;

    if (!emailId) {
      return res.status(400).json({ error: 'Email ID required' });
    }

    if (supabase) {
      const { error } = await (supabase as any)
        .from('draft_emails')
        .update({
          edited_subject: subject,
          edited_body_html: bodyHtml,
          edited_body_text: bodyText,
          edited_at: new Date().toISOString(),
          status: 'edited'
        })
        .eq('id', emailId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }
    }

    res.json({
      success: true,
      message: 'Email draft updated'
    });

  } catch (error) {
    console.error('Email edit error:', error);
    res.status(500).json({
      error: 'Failed to update email draft',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


/**
 * Bulk Approval Routes
 * Separate router for bulk approval operations
 */
export const bulkApprovalRouter = Router();

/**
 * POST /api/approvals/bulk
 * Approve multiple email drafts at once
 */
bulkApprovalRouter.post('/bulk', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { emailIds, action = 'approve' } = req.body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({ error: 'Email IDs array required' });
    }

    console.log(`📧 Bulk ${action} for ${emailIds.length} emails`);

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const emailId of emailIds) {
      try {
        if (action === 'approve') {
          // Create approval for each email
          const approval = await approvalService.createApproval({
            userId,
            actionType: 'send_email',
            actionData: { draftEmailId: emailId },
            expiresInHours: 24
          });

          // Auto-approve it
          await approvalService.reviewApproval(approval.id, {
            status: 'approved',
            reviewerNotes: 'Bulk approved via rescue email workflow'
          });

          // Update draft status
          if (supabase) {
            await (supabase as any)
              .from('draft_emails')
              .update({ status: 'approved', approval_id: approval.id })
              .eq('id', emailId);
          }

          results.successful++;
        } else if (action === 'reject') {
          if (supabase) {
            await (supabase as any)
              .from('draft_emails')
              .update({ status: 'rejected' })
              .eq('id', emailId);
          }
          results.successful++;
        }

        results.processed++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Email ${emailId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    res.json({
      success: results.failed === 0,
      results,
      message: `${action === 'approve' ? 'Approved' : 'Rejected'} ${results.successful}/${emailIds.length} emails`
    });

  } catch (error) {
    console.error('Bulk approval error:', error);
    res.status(500).json({
      error: 'Failed to process bulk approval',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/approvals/bulk/send
 * Send all approved emails
 */
bulkApprovalRouter.post('/bulk/send', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'File ID required' });
    }

    // Get approved emails for this file
    if (!supabase) {
      return res.json({
        success: true,
        message: 'Email sending simulated (Supabase not configured)',
        sent: 0
      });
    }

    const { data: drafts, error } = await (supabase as any)
      .from('draft_emails')
      .select('*')
      .eq('status', 'approved');

    if (error) {
      throw new Error(error.message);
    }

    // Note: Actual sending would be done through the approval service
    // which calls Gmail. For now, we update status to 'sent'
    let sentCount = 0;
    for (const draft of drafts || []) {
      // Create a send email approval and execute it
      const approval = await approvalService.createApproval({
        userId,
        actionType: 'send_email',
        actionData: {
          to: [draft.recipient_email],
          subject: draft.edited_subject || draft.subject,
          bodyHtml: draft.edited_body_html || draft.body_html,
          bodyText: draft.edited_body_text || draft.body_text
        }
      });

      // Auto-execute (the approval service will send the email)
      await approvalService.reviewApproval(approval.id, {
        status: 'approved'
      });

      // Update draft status
      await (supabase as any)
        .from('draft_emails')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', draft.id);

      sentCount++;
    }

    res.json({
      success: true,
      message: `Sent ${sentCount} rescue emails successfully`,
      sent: sentCount
    });

  } catch (error) {
    console.error('Bulk send error:', error);
    res.status(500).json({
      error: 'Failed to send emails',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// Helper function for fallback email generation
function generateFallbackEmailBody(account: ChurnRiskScore, html: boolean = true): string {
  const primaryConcern = account.primaryConcerns[0] || 'declining engagement';

  let body = `Hi ${account.customerName.split(' ')[0] || 'there'},

I noticed some changes in your usage patterns and wanted to reach out personally.

`;

  if (primaryConcern.includes('inactive') || primaryConcern.includes('login')) {
    body += `It looks like it's been a while since your team has been active, and I want to make sure everything is okay. We may have some new features that could help address any challenges you've been facing.`;
  } else if (primaryConcern.includes('decline') || primaryConcern.includes('usage')) {
    body += `I see your usage has changed recently, and I'd love to understand how we can better support your team's needs. Sometimes a quick call can help identify opportunities to get more value.`;
  } else {
    body += `I wanted to check in and see how things are going. Your success is our priority, and I'm here to help with anything you need.`;
  }

  body += `

Would you have 15 minutes this week for a quick call? I'd love to hear how we can better support you.

Best regards,
Your Customer Success Manager`;

  if (html) {
    return `<p>${body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
  }

  return body;
}
