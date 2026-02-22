/**
 * CSCX.AI Custom Report Builder Routes
 * PRD-180: Custom Report Builder
 *
 * API endpoints for creating, managing, executing, and scheduling custom reports.
 */

import { Router, Request, Response } from 'express';
import { customReportBuilderService } from '../services/reports/customReportBuilder.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Data Sources & Fields
// ============================================

/**
 * GET /api/reports/custom/data-sources
 * Get available data sources for report building
 */
router.get('/data-sources', async (req: Request, res: Response) => {
  try {
    const dataSources = customReportBuilderService.getDataSources();
    res.json({
      success: true,
      data: dataSources
    });
  } catch (error) {
    console.error('Error fetching data sources:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATA_SOURCES_ERROR',
        message: (error as Error).message || 'Failed to fetch data sources'
      }
    });
  }
});

/**
 * GET /api/reports/custom/data-sources/:source/fields
 * Get available fields for a specific data source
 */
router.get('/data-sources/:source/fields', async (req: Request, res: Response) => {
  try {
    const { source } = req.params;
    const fields = customReportBuilderService.getFieldsForDataSource(source as any);

    if (fields.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DATA_SOURCE_NOT_FOUND',
          message: `Data source '${source}' not found`
        }
      });
    }

    res.json({
      success: true,
      data: fields
    });
  } catch (error) {
    console.error('Error fetching fields:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FIELDS_ERROR',
        message: (error as Error).message || 'Failed to fetch fields'
      }
    });
  }
});

// ============================================
// Report CRUD Operations
// ============================================

/**
 * GET /api/reports/custom
 * List all accessible custom reports
 *
 * Query params:
 *   - search: Search in name and description
 *   - is_template: Filter templates only
 *   - data_source: Filter by data source
 *   - created_by: Filter by creator
 *   - sort_by: name | created_at | updated_at | execution_count
 *   - sort_order: asc | desc
 *   - page: Page number (default: 1)
 *   - page_size: Results per page (default: 20)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'user-1'; // Default for development

    const filters = {
      search: req.query.search as string | undefined,
      is_template: req.query.is_template === 'true' ? true : req.query.is_template === 'false' ? false : undefined,
      data_source: req.query.data_source as any,
      created_by: req.query.created_by as string | undefined,
      sort_by: (req.query.sort_by as 'name' | 'created_at' | 'updated_at' | 'execution_count') || 'updated_at',
      sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
      page: parseInt(req.query.page as string) || 1,
      page_size: parseInt(req.query.page_size as string) || 20
    };

    const { reports, total } = await customReportBuilderService.listReports(filters, userId);

    res.json({
      success: true,
      data: {
        reports,
        total,
        page: filters.page,
        page_size: filters.page_size,
        total_pages: Math.ceil(total / filters.page_size)
      }
    });
  } catch (error) {
    console.error('Error listing reports:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_REPORTS_ERROR',
        message: (error as Error).message || 'Failed to list reports'
      }
    });
  }
});

/**
 * GET /api/reports/custom/templates
 * Get all report templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = await customReportBuilderService.getTemplates();
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEMPLATES_ERROR',
        message: (error as Error).message || 'Failed to fetch templates'
      }
    });
  }
});

/**
 * POST /api/reports/custom
 * Create a new custom report
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'user-1';
    const userName = (req.headers['x-user-name'] as string) || 'Admin User';

    const { name, description, config, is_template, is_public, tags } = req.body;

    if (!name || !config || !config.data_source || !config.columns) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name, config.data_source, and config.columns are required'
        }
      });
    }

    const report = await customReportBuilderService.createReport(
      { name, description, config, is_template, is_public, tags },
      userId,
      userName
    );

    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_REPORT_ERROR',
        message: (error as Error).message || 'Failed to create report'
      }
    });
  }
});

/**
 * GET /api/reports/custom/:id
 * Get a specific custom report
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'user-1';
    const { id } = req.params;

    const report = await customReportBuilderService.getReport(id, userId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found or access denied'
        }
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_REPORT_ERROR',
        message: (error as Error).message || 'Failed to fetch report'
      }
    });
  }
});

/**
 * PUT /api/reports/custom/:id
 * Update a custom report
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'user-1';
    const { id } = req.params;
    const { name, description, config, is_template, is_public, tags } = req.body;

    const report = await customReportBuilderService.updateReport(
      id,
      { name, description, config, is_template, is_public, tags },
      userId
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found or insufficient permissions'
        }
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_REPORT_ERROR',
        message: (error as Error).message || 'Failed to update report'
      }
    });
  }
});

/**
 * DELETE /api/reports/custom/:id
 * Delete a custom report
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'user-1';
    const { id } = req.params;

    const deleted = await customReportBuilderService.deleteReport(id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found or insufficient permissions'
        }
      });
    }

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_REPORT_ERROR',
        message: (error as Error).message || 'Failed to delete report'
      }
    });
  }
});

// ============================================
// Report Execution
// ============================================

/**
 * POST /api/reports/custom/:id/execute
 * Execute a saved report and return results
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'user-1';
    const { id } = req.params;

    const result = await customReportBuilderService.executeReport(id, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error executing report:', error);

    if ((error as Error).message === 'Report not found or access denied') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found or access denied'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'EXECUTE_REPORT_ERROR',
        message: (error as Error).message || 'Failed to execute report'
      }
    });
  }
});

/**
 * POST /api/reports/custom/preview
 * Execute a report config without saving (for preview)
 */
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { config } = req.body;

    if (!config || !config.data_source || !config.columns) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'config.data_source and config.columns are required'
        }
      });
    }

    const result = await customReportBuilderService.executeReportConfig(config);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error previewing report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PREVIEW_ERROR',
        message: (error as Error).message || 'Failed to preview report'
      }
    });
  }
});

// ============================================
// Scheduling
// ============================================

/**
 * POST /api/reports/custom/:id/schedule
 * Schedule recurring report execution and delivery
 */
router.post('/:id/schedule', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'user-1';
    const { id } = req.params;
    const { frequency, day_of_week, day_of_month, time, timezone, recipients, export_format } = req.body;

    if (!frequency || !time || !timezone || !recipients || !export_format) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'frequency, time, timezone, recipients, and export_format are required'
        }
      });
    }

    const report = await customReportBuilderService.scheduleReport(
      id,
      { frequency, day_of_week, day_of_month, time, timezone, recipients, export_format },
      userId
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found or insufficient permissions'
        }
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error scheduling report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCHEDULE_ERROR',
        message: (error as Error).message || 'Failed to schedule report'
      }
    });
  }
});

/**
 * DELETE /api/reports/custom/:id/schedule
 * Remove report schedule
 */
router.delete('/:id/schedule', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'user-1';
    const { id } = req.params;

    const report = await customReportBuilderService.removeSchedule(id, userId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found or insufficient permissions'
        }
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error removing schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REMOVE_SCHEDULE_ERROR',
        message: (error as Error).message || 'Failed to remove schedule'
      }
    });
  }
});

// ============================================
// Sharing
// ============================================

/**
 * POST /api/reports/custom/:id/share
 * Share a report with another user
 */
router.post('/:id/share', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'user-1';
    const { id } = req.params;
    const { user_id, permission, user_name, user_email } = req.body;

    if (!user_id || !permission) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'user_id and permission are required'
        }
      });
    }

    const report = await customReportBuilderService.shareReport(
      id,
      { user_id, permission, user_name, user_email },
      userId
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found or insufficient permissions'
        }
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error sharing report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SHARE_ERROR',
        message: (error as Error).message || 'Failed to share report'
      }
    });
  }
});

/**
 * DELETE /api/reports/custom/:id/share/:targetUserId
 * Remove a user's access to a report
 */
router.delete('/:id/share/:targetUserId', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'user-1';
    const { id, targetUserId } = req.params;

    const report = await customReportBuilderService.removeShare(id, targetUserId, userId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found or insufficient permissions'
        }
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error removing share:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REMOVE_SHARE_ERROR',
        message: (error as Error).message || 'Failed to remove share'
      }
    });
  }
});

// ============================================
// Duplication
// ============================================

/**
 * POST /api/reports/custom/:id/duplicate
 * Duplicate an existing report
 */
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'user-1';
    const userName = (req.headers['x-user-name'] as string) || 'Admin User';
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name is required for duplicate'
        }
      });
    }

    const report = await customReportBuilderService.duplicateReport(id, name, userId, userName);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found or access denied'
        }
      });
    }

    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error duplicating report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DUPLICATE_ERROR',
        message: (error as Error).message || 'Failed to duplicate report'
      }
    });
  }
});

export default router;
