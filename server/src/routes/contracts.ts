import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ContractParser } from '../services/contractParser.js';
import { ClaudeService } from '../services/claude.js';
import { SupabaseService } from '../services/supabase.js';

const router = Router();
const contractParser = new ContractParser();
const claude = new ClaudeService();
const db = new SupabaseService();

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
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
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

    // Save to database
    const contract = await db.saveContract({
      file_name: file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      raw_text: result.rawText.substring(0, 50000), // Limit stored text
      company_name: result.extraction.company_name,
      arr: result.extraction.arr,
      contract_period: result.extraction.contract_period,
      parsed_data: result.extraction,
      confidence: result.confidence,
      status: 'active'
    });

    res.json({
      id: contract.id,
      contractData: result.extraction,
      summary: result.summary,
      research: result.research,
      plan: result.plan,
      confidence: result.confidence
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

// POST /api/contracts/parse - Parse contract from text/base64
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { type, content, mimeType, fileName } = req.body;

    if (!content) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Content is required' }
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

    // Save to database (confidence stored in parsed_data)
    const contract = await db.saveContract({
      file_name: fileName,
      raw_text: type === 'text' ? content.substring(0, 50000) : null,
      company_name: result.extraction.company_name,
      arr: result.extraction.arr,
      contract_term: result.extraction.contract_period,
      parsed_data: { ...result.extraction, confidence: result.confidence },
      status: 'active'
    });

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

    // Get original contract
    const contract = await db.getContract(id);
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

    const contract = await db.saveContract({
      customer_id,
      file_name: file_name || 'Unknown',
      file_type: file_type || 'unknown',
      file_size: file_size || 0,
      company_name: companyName,
      arr,
      contract_period: contractPeriod,
      parsed_data,
      status
    });

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

// GET /api/contracts/:id - Get contract by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contract = await db.getContract(id);

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

// GET /api/contracts - List contracts
router.get('/', async (req: Request, res: Response) => {
  try {
    const { customerId, status, search, limit = '20', offset = '0' } = req.query;

    const result = await db.listContracts({
      customerId: customerId as string,
      status: status as string,
      search: search as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
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
