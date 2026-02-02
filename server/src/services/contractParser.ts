import { ClaudeService, ContractExtraction, CompanyResearch, OnboardingPlan } from './claude.js';
import { GeminiService } from './gemini.js';
import { docsService } from './google/docs.js';

// Types for file handling
export interface ParsedContract {
  extraction: ContractExtraction;
  summary: string;
  research: CompanyResearch;
  plan: OnboardingPlan;
  rawText: string;
  confidence: number;
  extractionMethod?: 'pdf' | 'docx' | 'text' | 'gdoc' | 'gemini_multimodal';
}

export interface ContractInput {
  type: 'text' | 'file' | 'gdoc';
  content: string; // raw text, base64 string, or Google Doc URL/ID
  mimeType?: string;
  fileName?: string;
  userId?: string; // Required for Google Docs API access
}

export class ContractParser {
  private claude: ClaudeService;
  private gemini: GeminiService;

  constructor() {
    this.claude = new ClaudeService();
    this.gemini = new GeminiService();
  }

  /**
   * Parse a contract from text or file input
   */
  async parse(input: ContractInput): Promise<ParsedContract> {
    let extraction: ContractExtraction;
    let rawText = '';

    try {
      // For PDFs, use Gemini's native multimodal parsing
      if (input.type === 'file' && input.mimeType === 'application/pdf') {
        console.log('📄 Using Gemini multimodal for PDF parsing...');
        extraction = await this.parseWithGeminiMultimodal(input.content, input.mimeType);
        rawText = '[PDF parsed via Gemini multimodal]';
      } else {
        // Extract text from the input
        console.log('📝 Extracting text from document...');
        rawText = await this.extractText(input);

        if (!rawText || rawText.trim().length < 50) {
          throw new Error('Could not extract sufficient text from the document');
        }

        console.log(`📝 Extracted ${rawText.length} characters, parsing with Claude...`);
        // Parse with Claude (falls back to Gemini)
        extraction = await this.claude.parseContract(rawText);
      }

      console.log('✅ Extraction complete:', {
        company: extraction.company_name,
        arr: extraction.arr,
        stakeholders: extraction.stakeholders?.length || 0,
        entitlements: extraction.entitlements?.length || 0
      });

      // Calculate overall confidence
      const confidence = this.calculateConfidence(extraction);

      // Generate additional insights in parallel
      console.log('🔍 Generating insights (summary, research, plan)...');
      const [summary, research, plan] = await Promise.all([
        this.claude.generateSummary(extraction).catch(err => {
          console.error('Summary generation error:', err);
          return 'Summary generation failed';
        }),
        this.claude.researchCompany(extraction.company_name).catch(err => {
          console.error('Research generation error:', err);
          return {
            company_name: extraction.company_name,
            domain: '',
            industry: 'Unknown',
            employee_count: 0,
            tech_stack: [],
            recent_news: [],
            key_initiatives: [],
            competitors: [],
            overview: 'Research unavailable'
          };
        }),
        this.claude.createOnboardingPlan(
          { name: extraction.company_name, arr: extraction.arr },
          extraction.entitlements || [],
          extraction.stakeholders || [],
          90
        ).catch(err => {
          console.error('Plan generation error:', err);
          return {
            timeline_days: 90,
            phases: [],
            risk_factors: [],
            opportunities: [],
            recommended_touchpoints: []
          };
        })
      ]);

      console.log('✅ All insights generated successfully');

      return {
        extraction,
        summary,
        research,
        plan,
        rawText,
        confidence
      };
    } catch (error) {
      console.error('❌ Contract parsing error:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('❌ Input details:', {
        type: input.type,
        mimeType: input.mimeType,
        fileName: input.fileName,
        contentLength: input.content?.length || 0
      });
      throw error;
    }
  }

  /**
   * Parse PDF directly using Gemini's multimodal capability
   */
  private async parseWithGeminiMultimodal(base64Content: string, mimeType: string): Promise<ContractExtraction> {
    return this.gemini.parseDocument(base64Content, mimeType) as unknown as ContractExtraction;
  }

  /**
   * Parse only the contract extraction (faster, no additional insights)
   */
  async parseOnly(input: ContractInput): Promise<ContractExtraction> {
    // For PDFs, use Gemini multimodal
    if (input.type === 'file' && input.mimeType === 'application/pdf') {
      return this.parseWithGeminiMultimodal(input.content, input.mimeType);
    }

    const rawText = await this.extractText(input);

    if (!rawText || rawText.trim().length < 50) {
      throw new Error('Could not extract sufficient text from the document');
    }

    return this.claude.parseContract(rawText);
  }

  /**
   * Extract text from various input types
   */
  private async extractText(input: ContractInput): Promise<string> {
    if (input.type === 'text') {
      return input.content;
    }

    // Handle Google Docs
    if (input.type === 'gdoc') {
      return this.extractFromGoogleDoc(input.content, input.userId);
    }

    // Handle file input (base64 encoded)
    const mimeType = input.mimeType || 'application/octet-stream';
    const base64Data = input.content;

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    if (mimeType === 'application/pdf') {
      return this.extractFromPDF(buffer);
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword') {
      return this.extractFromDOCX(buffer);
    }

    if (mimeType.startsWith('text/')) {
      return buffer.toString('utf-8');
    }

    // For other types, try to read as text
    return buffer.toString('utf-8');
  }

  /**
   * Extract text from a Google Doc
   */
  private async extractFromGoogleDoc(docIdOrUrl: string, userId?: string): Promise<string> {
    if (!userId) {
      throw new Error('User ID is required to access Google Docs');
    }

    // Extract document ID from URL if needed
    const docId = this.extractGoogleDocId(docIdOrUrl);
    if (!docId) {
      throw new Error('Invalid Google Docs URL or ID');
    }

    try {
      console.log(`📄 Extracting text from Google Doc: ${docId}`);
      const doc = await docsService.getDocument(userId, docId);

      if (!doc.content || doc.content.trim().length < 50) {
        throw new Error('Google Doc appears to be empty or has insufficient content');
      }

      console.log(`✅ Extracted ${doc.content.length} characters from Google Doc`);
      return doc.content;
    } catch (error) {
      console.error('Google Docs extraction error:', error);
      if (error instanceof Error) {
        if (error.message.includes('permission') || error.message.includes('access')) {
          throw new Error('Access denied to Google Doc. Please ensure the document is shared with the appropriate permissions.');
        }
      }
      throw new Error('Failed to extract text from Google Doc. Please check the URL and try again.');
    }
  }

  /**
   * Extract Google Doc ID from URL or return ID if already an ID
   */
  private extractGoogleDocId(input: string): string | null {
    // If it's already just an ID (no slashes or dots)
    if (/^[a-zA-Z0-9_-]+$/.test(input) && input.length > 20) {
      return input;
    }

    // Try to extract from various Google Docs URL formats
    const patterns = [
      /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/,
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
      /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract text from PDF using pdf-parse (fallback)
   */
  private async extractFromPDF(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (error) {
      console.error('PDF text extraction failed, will use multimodal:', error);
      // Return marker so we know to use multimodal
      throw new Error('PDF_NEEDS_MULTIMODAL');
    }
  }

  /**
   * Extract text from DOCX using mammoth
   */
  private async extractFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (error) {
      console.error('DOCX parsing error:', error);
      throw new Error('Failed to extract text from DOCX. Please try uploading a different format.');
    }
  }

  /**
   * Calculate overall confidence score from extraction
   */
  private calculateConfidence(extraction: ContractExtraction): number {
    const scores = extraction.confidence_scores;
    if (!scores) {
      return 0.7; // Default confidence if not provided
    }

    const values = Object.values(scores);
    if (values.length === 0) {
      return 0.7;
    }

    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Re-parse a contract with corrections
   */
  async reparseWithCorrections(
    originalText: string,
    corrections: Record<string, unknown>
  ): Promise<ContractExtraction> {
    const prompt = `
Previously parsed contract text:
${originalText}

User corrections to apply:
${JSON.stringify(corrections, null, 2)}

Please re-parse this contract incorporating the user's corrections while maintaining accuracy for unchanged fields.
`;

    return this.claude.parseContract(prompt);
  }
}

// Export singleton instance
export const contractParser = new ContractParser();
