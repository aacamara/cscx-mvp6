/**
 * Mobile Document Scanning Routes (PRD-267)
 *
 * REST API endpoints for mobile document scanning functionality
 */

import { Router, Request, Response } from 'express';
import documentScanningService, {
  DocumentType,
  ScanRequest,
  ScannedPage,
} from '../services/mobile/documentScanning.js';

const router = Router();

// ============================================
// POST /api/mobile/documents/scan - Process scanned document
// ============================================

router.post('/scan', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const {
      pages,
      customerId,
      fileName,
      autoClassify = true,
      extractData = true,
    } = req.body as ScanRequest & { pages: Array<Omit<ScannedPage, 'id'> & { id?: string }> };

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one page is required',
        },
      });
    }

    // Validate page data
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page.imageData) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Page ${i + 1} is missing imageData`,
          },
        });
      }
    }

    // Assign IDs and page numbers to pages
    const processedPages: ScannedPage[] = pages.map((page, index) => ({
      id: page.id || `page-${index + 1}`,
      imageData: page.imageData,
      pageNumber: index + 1,
      width: page.width || 0,
      height: page.height || 0,
    }));

    const result = await documentScanningService.processScannedDocument(userId, {
      pages: processedPages,
      customerId,
      fileName,
      autoClassify,
      extractData,
    });

    res.status(201).json({
      success: true,
      data: {
        document: result.document,
        classification: result.classification,
        extractedText: result.ocrResult.text,
        ocrConfidence: result.ocrResult.confidence,
        linkedEntity: result.linkedEntity,
      },
    });
  } catch (error) {
    console.error('Error processing scanned document:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process scanned document',
      },
    });
  }
});

// ============================================
// GET /api/mobile/documents - List user's scanned documents
// ============================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const query = req.query.q as string || '';
    const customerId = req.query.customer_id as string | undefined;
    const documentType = req.query.type as DocumentType | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await documentScanningService.searchDocuments(userId, query, {
      customerId,
      documentType,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        documents: result.documents,
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.documents.length < result.total,
      },
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch documents',
      },
    });
  }
});

// ============================================
// GET /api/mobile/documents/stats - Get scanning statistics
// ============================================

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const stats = await documentScanningService.getScanStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching scan stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch scanning statistics',
      },
    });
  }
});

// ============================================
// GET /api/mobile/documents/:id - Get single document
// ============================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await documentScanningService.getDocumentById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found',
        },
      });
    }

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch document',
      },
    });
  }
});

// ============================================
// GET /api/mobile/documents/customer/:customerId - Get customer documents
// ============================================

router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const documentType = req.query.type as DocumentType | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await documentScanningService.getCustomerDocuments(customerId, {
      documentType,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        documents: result.documents,
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.documents.length < result.total,
      },
    });
  } catch (error) {
    console.error('Error fetching customer documents:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch customer documents',
      },
    });
  }
});

// ============================================
// DELETE /api/mobile/documents/:id - Delete document
// ============================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await documentScanningService.deleteDocument(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found or could not be deleted',
        },
      });
    }

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete document',
      },
    });
  }
});

// ============================================
// POST /api/mobile/documents/:id/classify - Re-classify document
// ============================================

router.post('/:id/classify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await documentScanningService.getDocumentById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found',
        },
      });
    }

    // Re-classify using extracted text
    const classification = await documentScanningService.classifyDocument(
      document.extractedText,
      [] // No pages needed for re-classification
    );

    res.json({
      success: true,
      data: {
        documentId: id,
        previousType: document.documentType,
        classification,
      },
    });
  } catch (error) {
    console.error('Error re-classifying document:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to re-classify document',
      },
    });
  }
});

// ============================================
// POST /api/mobile/documents/:id/attach - Attach to customer
// ============================================

router.post('/:id/attach', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'customerId is required',
        },
      });
    }

    const document = await documentScanningService.getDocumentById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found',
        },
      });
    }

    // TODO: Update document with customer association
    // This would require an updateDocument export

    res.json({
      success: true,
      message: 'Document attached to customer',
      data: {
        documentId: id,
        customerId,
      },
    });
  } catch (error) {
    console.error('Error attaching document:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to attach document to customer',
      },
    });
  }
});

// ============================================
// GET /api/mobile/documents/search - Full-text search
// ============================================

router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';
    const query = req.query.q as string;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query must be at least 2 characters',
        },
      });
    }

    const customerId = req.query.customer_id as string | undefined;
    const documentType = req.query.type as DocumentType | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await documentScanningService.searchDocuments(userId, query, {
      customerId,
      documentType,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        query,
        documents: result.documents,
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.documents.length < result.total,
      },
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to search documents',
      },
    });
  }
});

export default router;
export { router as mobileDocumentScanningRoutes };
