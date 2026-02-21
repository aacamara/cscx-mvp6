import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ContractParser } from '../services/contractParser.js';
import { ClaudeService } from '../services/claude.js';
import { SupabaseService } from '../services/supabase.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();
const contractParser = new ContractParser();
const claude = new ClaudeService();
const db = new SupabaseService();

// Helper: Extract start date from contract extraction
function extractStartDate(extraction: Record<string, any>): string | null {
  // Try direct start_date field
  if (extraction.start_date) {
    return normalizeDate(extraction.start_date);
  }

  // Try parsing from contract_period (e.g., "Jan 1, 2025 - Dec 31, 2025")
  if (extraction.contract_period) {
    const period = extraction.contract_period;
    const dateMatch = period.match(/(\w+\s+\d{1,2},?\s+\d{4})/);
    if (dateMatch) {
      return normalizeDate(dateMatch[1]);
    }
  }

  // Try from first entitlement
  if (extraction.entitlements?.length > 0) {
    const firstEntitlement = extraction.entitlements[0];
    if (firstEntitlement.start_date) {
      return normalizeDate(firstEntitlement.start_date);
    }
  }

  return null;
}

// Helper: Extract end date from contract extraction
function extractEndDate(extraction: Record<string, any>): string | null {
  // Try direct end_date field
  if (extraction.end_date) {
    return normalizeDate(extraction.end_date);
  }

  // Try parsing from contract_period (e.g., "Jan 1, 2025 - Dec 31, 2025")
  if (extraction.contract_period) {
    const period = extraction.contract_period;
    const dateMatches = period.match(/(\w+\s+\d{1,2},?\s+\d{4})/g);
    if (dateMatches && dateMatches.length >= 2) {
      return normalizeDate(dateMatches[1]);
    }
  }

  // Try from first entitlement
  if (extraction.entitlements?.length > 0) {
    const firstEntitlement = extraction.entitlements[0];
    if (firstEntitlement.end_date) {
      return normalizeDate(firstEntitlement.end_date);
    }
  }

  return null;
}

// Helper: Normalize date string to ISO format
function normalizeDate(dateStr: string): string | null {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// Helper: Save entitlements to database
async function saveEntitlements(
  dbService: SupabaseService,
  contractId: string,
  customerId: string | null,
  entitlements: Array<{
    type?: string;
    description: string;
    quantity?: string | number;
    start_date?: string;
    end_date?: string;
  }>,
  req: Request
): Promise<void> {
  for (const entitlement of entitlements) {
    try {
      await dbService.saveEntitlement(withOrgId({
        contract_id: contractId,
        customer_id: customerId,
        name: entitlement.type || 'Entitlement',
        description: entitlement.description,
        quantity: typeof entitlement.quantity === 'string'
          ? parseInt(entitlement.quantity) || null
          : entitlement.quantity || null,
        start_date: entitlement.start_date ? normalizeDate(entitlement.start_date) : null,
        end_date: entitlement.end_date ? normalizeDate(entitlement.end_date) : null
      }, req));
    } catch (err) {
      console.error('[Contracts] Failed to save entitlement:', err);
    }
  }
}

// Configure multer for file uploads (memory storage for processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
    }
  }
});

// POST /api/contracts/upload - Upload and parse contract file
router.post('/upload', optionalAuthMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' }
      });
    }

    console.log(`Processing file: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);

    // Parse the contract
    const result = await contractParser.parse({
      type: 'file',
      content: file.buffer.toString('base64'),
      mimeType: file.mimetype,
      fileName: file.originalname
    });

    // Upload file to Supabase Storage
    // Use user_id/pending/filename path since customer_id isn't available yet
    const userId = req.userId || 'anonymous';
    const timestamp = Date.now();
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${userId}/pending/${timestamp}_${sanitizedFileName}`;

    let fileUrl: string | undefined;
    try {
      const uploadResult = await db.uploadFile(
        'contracts',
        storagePath,
        file.buffer,
        file.mimetype
      );
      fileUrl = uploadResult?.url;
      console.log(`File uploaded to storage: ${fileUrl}`);
    } catch (storageError) {
      // Log but don't fail the request - storage upload is optional
      console.error('Storage upload failed (continuing without file URL):', storageError);
    }

    // Extract dates from parsed data
    const startDate = extractStartDate(result.extraction);
    const endDate = extractEndDate(result.extraction);
    const totalValue = result.extraction.arr || 0;

    // Save to database
    console.log('[Contracts] Saving contract with dates:', { startDate, endDate, totalValue });
    const contract = await db.saveContract(withOrgId({
      file_name: file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      file_url: fileUrl,
      raw_text: result.rawText.substring(0, 50000), // Limit stored text
      company_name: result.extraction.company_name,
      arr: result.extraction.arr,
      contract_period: result.extraction.contract_period,
      parsed_data: result.extraction,
      confidence: result.confidence,
      status: 'active',
      start_date: startDate,
      end_date: endDate,
      total_value: totalValue
    }, req));

    // Save entitlements (line items) if present
    if (result.extraction.entitlements && result.extraction.entitlements.length > 0) {
      console.log(`[Contracts] Saving ${result.extraction.entitlements.length} entitlements`);
      await saveEntitlements(db, contract.id, null, result.extraction.entitlements, req);
    }

    res.json({
      id: contract.id,
      contractData: result.extraction,
      summary: result.summary,
      research: result.research,
      plan: result.plan,
      confidence: result.confidence,
      fileUrl
    });
  } catch (error) {
    console.error('Contract upload error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to process contract'
      }
    });
  }
});

// POST /api/contracts/parse - Parse contract from text/base64/gdoc
router.post('/parse', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { type, content, mimeType, fileName, google_doc_url } = req.body;
    const userId = req.userId;

    // Handle Google Doc URL
    if (google_doc_url) {
      if (!userId) {
        return res.status(401).json({
          error: { code: 'AUTH_REQUIRED', message: 'Authentication required to access Google Docs' }
        });
      }

      console.log(`Parsing Google Doc: ${google_doc_url}`);

      const result = await contractParser.parse({
        type: 'gdoc',
        content: google_doc_url,
        userId
      });

      // Save to database
      const contract = await db.saveContract(withOrgId({
        file_name: fileName || 'Google Doc Contract',
        file_type: 'gdoc',
        google_doc_url,
        raw_text: result.rawText.substring(0, 50000),
        company_name: result.extraction.company_name,
        arr: result.extraction.arr,
        contract_period: result.extraction.contract_period,
        parsed_data: { ...result.extraction, confidence: result.confidence },
        status: 'parsed',
        parsed_at: new Date().toISOString(),
        start_date: extractStartDate(result.extraction),
        end_date: extractEndDate(result.extraction),
        total_value: result.extraction.arr || 0
      }, req));

      // Save entitlements
      if (result.extraction.entitlements?.length > 0) {
        console.log(`[Contracts] Saving ${result.extraction.entitlements.length} entitlements from Google Doc`);
        await saveEntitlements(db, contract.id, null, result.extraction.entitlements, req);
      }

      return res.json({
        id: contract.id,
        contractData: result.extraction,
        summary: result.summary,
        research: result.research,
        plan: result.plan,
        confidence: result.confidence
      });
    }

    if (!content) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Content or google_doc_url is required' }
      });
    }

    console.log(`Parsing contract: type=${type}, mimeType=${mimeType}`);

    // Parse the contract with Claude
    const result = await contractParser.parse({
      type: type || 'text',
      content,
      mimeType,
      fileName
    });

    // Extract dates from parsed data
    const startDate = extractStartDate(result.extraction);
    const endDate = extractEndDate(result.extraction);
    const totalValue = result.extraction.arr || 0;

    // Save to database (confidence stored in parsed_data)
    console.log('[Contracts] Saving parsed contract with dates:', { startDate, endDate, totalValue });
    const contract = await db.saveContract(withOrgId({
      file_name: fileName,
      raw_text: type === 'text' ? content.substring(0, 50000) : null,
      company_name: result.extraction.company_name,
      arr: result.extraction.arr,
      contract_term: result.extraction.contract_period,
      parsed_data: { ...result.extraction, confidence: result.confidence },
      status: 'active',
      start_date: startDate,
      end_date: endDate,
      total_value: totalValue
    }, req));

    // Save entitlements (line items) if present
    if (result.extraction.entitlements && result.extraction.entitlements.length > 0) {
      console.log(`[Contracts] Saving ${result.extraction.entitlements.length} entitlements`);
      await saveEntitlements(db, contract.id, null, result.extraction.entitlements, req);
    }

    res.json({
      id: contract.id,
      contractData: result.extraction,
      summary: result.summary,
      research: result.research,
      plan: result.plan,
      confidence: result.confidence
    });
  } catch (error) {
    console.error('Contract parse error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to parse contract'
      }
    });
  }
});

// POST /api/contracts/:id/reparse - Re-parse contract with corrections
router.post('/:id/reparse', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { corrections } = req.body;

    // Get original contract (org-filtered)
    const contract = await db.getContract(id, (req as any).organizationId || null);
    if (!contract) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Contract not found' }
      });
    }

    // Re-parse with corrections
    const originalText = (contract as { raw_text?: string }).raw_text || '';
    const newExtraction = await contractParser.reparseWithCorrections(originalText, corrections);

    // Update in database (would need to add this method)
    res.json({
      id,
      contractData: newExtraction,
      message: 'Contract re-parsed with corrections'
    });
  } catch (error) {
    console.error('Contract reparse error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to re-parse contract' }
    });
  }
});

// POST /api/contracts - Create a contract record (without file upload)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { customer_id, file_name, file_type, file_size, parsed_data, status = 'parsed' } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'customer_id is required' }
      });
    }

    // Extract common fields from parsed_data for easier querying
    const companyName = parsed_data?.company_name;
    const arr = parsed_data?.arr;
    const contractPeriod = parsed_data?.contract_period;

    // Extract dates
    const startDate = parsed_data ? extractStartDate(parsed_data) : null;
    const endDate = parsed_data ? extractEndDate(parsed_data) : null;
    const totalValue = arr || 0;

    console.log('[Contracts] Creating contract with dates:', { startDate, endDate, totalValue });
    const contract = await db.saveContract(withOrgId({
      customer_id,
      file_name: file_name || 'Unknown',
      file_type: file_type || 'unknown',
      file_size: file_size || 0,
      company_name: companyName,
      arr,
      contract_period: contractPeriod,
      parsed_data,
      status,
      start_date: startDate,
      end_date: endDate,
      total_value: totalValue
    }, req));

    // Save entitlements if present
    if (parsed_data?.entitlements && parsed_data.entitlements.length > 0) {
      console.log(`[Contracts] Saving ${parsed_data.entitlements.length} entitlements`);
      await saveEntitlements(db, contract.id, customer_id, parsed_data.entitlements, req);
    }

    res.status(201).json(contract);
  } catch (error) {
    console.error('Create contract error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create contract'
      }
    });
  }
});

// GET /api/contracts/:id - Get contract by ID (org-filtered)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contract = await db.getContract(id, (req as any).organizationId || null);

    if (!contract) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Contract not found' }
      });
    }

    res.json(contract);
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get contract' }
    });
  }
});

// GET /api/contracts - List contracts (org-filtered)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { customerId, status, search, limit = '20', offset = '0' } = req.query;

    const result = await db.listContracts({
      customerId: customerId as string,
      status: status as string,
      search: search as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      organizationId: (req as any).organizationId || null
    });

    // Transform contracts for frontend
    const contracts = result.contracts.map(c => ({
      id: c.id,
      fileName: c.file_name,
      fileType: c.file_type,
      fileSize: c.file_size,
      companyName: c.company_name,
      arr: c.arr,
      contractPeriod: c.contract_period || c.contract_term,
      status: c.status,
      parsedData: c.parsed_data,
      customerId: c.customer_id,
      customerName: (c.customers as any)?.name,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));

    res.json({
      contracts,
      total: result.total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('List contracts error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list contracts' }
    });
  }
});

export { router as contractRoutes };
