/**
 * Mobile Document Scanning Service (PRD-267)
 *
 * Service for processing scanned documents from mobile devices,
 * including OCR, document classification, and data extraction.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import Anthropic from '@anthropic-ai/sdk';

// ============================================
// Types
// ============================================

export type DocumentType = 'contract' | 'business_card' | 'meeting_notes' | 'invoice' | 'other';

export interface ScannedPage {
  id: string;
  imageData: string; // Base64 encoded image
  pageNumber: number;
  width: number;
  height: number;
  processedAt?: Date;
}

export interface BusinessCardData {
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedinUrl?: string;
  website?: string;
}

export interface ContractData {
  customerName?: string;
  contractValue?: number;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  terms?: string[];
  keyProvisions?: string[];
}

export interface MeetingNotesData {
  meetingDate?: string;
  attendees?: string[];
  topics?: string[];
  actionItems?: string[];
  decisions?: string[];
  nextSteps?: string[];
}

export interface OCRResult {
  text: string;
  confidence: number;
  blocks: TextBlock[];
}

export interface TextBlock {
  text: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface DocumentClassification {
  documentType: DocumentType;
  confidence: number;
  extractedData?: BusinessCardData | ContractData | MeetingNotesData;
}

export interface ScannedDocument {
  id: string;
  userId: string;
  customerId?: string;
  customerName?: string;
  fileName: string;
  documentType: DocumentType;
  pageCount: number;
  extractedText: string;
  ocrConfidence: number;
  structuredData?: Record<string, unknown>;
  fileUrl?: string;
  thumbnailUrl?: string;
  isSearchable: boolean;
  linkedContactId?: string;
  linkedContractId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScanRequest {
  pages: ScannedPage[];
  customerId?: string;
  fileName?: string;
  autoClassify?: boolean;
  extractData?: boolean;
}

export interface ScanResult {
  document: ScannedDocument;
  classification: DocumentClassification;
  ocrResult: OCRResult;
  linkedEntity?: {
    type: 'contact' | 'contract';
    id: string;
    name: string;
  };
}

// ============================================
// Initialize Clients
// ============================================

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({
    apiKey: config.anthropicApiKey,
  });
}

// ============================================
// In-Memory Store (Fallback)
// ============================================

const documentStore: Map<string, ScannedDocument> = new Map();
const searchIndex: Map<string, Set<string>> = new Map(); // word -> document IDs

// ============================================
// OCR Processing
// ============================================

/**
 * Perform OCR on scanned pages using Claude's vision capabilities
 */
export async function performOCR(pages: ScannedPage[]): Promise<OCRResult> {
  if (!anthropic) {
    // Fallback: Return empty result if no API configured
    return {
      text: '',
      confidence: 0,
      blocks: [],
    };
  }

  const allText: string[] = [];
  const allBlocks: TextBlock[] = [];
  let totalConfidence = 0;

  for (const page of pages) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: page.imageData,
                },
              },
              {
                type: 'text',
                text: `Extract ALL text from this document image. Preserve the original formatting, line breaks, and structure as much as possible. Include everything you can read, even if partially visible. Return ONLY the extracted text, nothing else.`,
              },
            ],
          },
        ],
      });

      const extractedText = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      allText.push(extractedText);

      // Create a single text block for the page
      allBlocks.push({
        text: extractedText,
        boundingBox: { x: 0, y: 0, width: page.width, height: page.height },
        confidence: 0.95, // Claude typically has high accuracy
      });

      totalConfidence += 0.95;
    } catch (error) {
      console.error(`OCR failed for page ${page.pageNumber}:`, error);
      allBlocks.push({
        text: '',
        boundingBox: { x: 0, y: 0, width: page.width, height: page.height },
        confidence: 0,
      });
    }
  }

  return {
    text: allText.join('\n\n--- Page Break ---\n\n'),
    confidence: pages.length > 0 ? totalConfidence / pages.length : 0,
    blocks: allBlocks,
  };
}

// ============================================
// Document Classification
// ============================================

/**
 * Classify document type and extract structured data
 */
export async function classifyDocument(
  text: string,
  pages: ScannedPage[]
): Promise<DocumentClassification> {
  if (!anthropic || !text.trim()) {
    return {
      documentType: 'other',
      confidence: 0,
    };
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Analyze this document text and classify it into one of these categories:
- contract: Legal agreements, service contracts, terms of service
- business_card: Contact information cards
- meeting_notes: Notes from meetings, action items, minutes
- invoice: Bills, receipts, payment documents
- other: Any other document type

Document text:
"""
${text.substring(0, 4000)}
"""

Respond in JSON format:
{
  "documentType": "contract|business_card|meeting_notes|invoice|other",
  "confidence": 0.0-1.0,
  "extractedData": { ... relevant structured data based on document type ... }
}

For business_card, extract: name, title, company, email, phone, address, linkedinUrl, website
For contract, extract: customerName, contractValue, startDate, endDate, renewalDate, terms[], keyProvisions[]
For meeting_notes, extract: meetingDate, attendees[], topics[], actionItems[], decisions[], nextSteps[]
For invoice, extract: invoiceNumber, amount, dueDate, vendor, lineItems[]

Only include fields that you can confidently extract from the text.`,
        },
      ],
    });

    const responseText = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        documentType: parsed.documentType || 'other',
        confidence: parsed.confidence || 0.5,
        extractedData: parsed.extractedData,
      };
    }
  } catch (error) {
    console.error('Document classification failed:', error);
  }

  return {
    documentType: 'other',
    confidence: 0.3,
  };
}

// ============================================
// Document Processing
// ============================================

/**
 * Process scanned document - main entry point
 */
export async function processScannedDocument(
  userId: string,
  request: ScanRequest
): Promise<ScanResult> {
  const documentId = uuidv4();

  // Perform OCR
  const ocrResult = await performOCR(request.pages);

  // Classify document
  const classification = request.autoClassify !== false
    ? await classifyDocument(ocrResult.text, request.pages)
    : { documentType: 'other' as DocumentType, confidence: 0 };

  // Get customer name if customerId provided
  let customerName: string | undefined;
  if (request.customerId && supabase) {
    const { data } = await supabase
      .from('customers')
      .select('name')
      .eq('id', request.customerId)
      .single();
    customerName = data?.name;
  }

  // Create document record
  const document: ScannedDocument = {
    id: documentId,
    userId,
    customerId: request.customerId,
    customerName,
    fileName: request.fileName || `Scan_${new Date().toISOString().split('T')[0]}.pdf`,
    documentType: classification.documentType,
    pageCount: request.pages.length,
    extractedText: ocrResult.text,
    ocrConfidence: ocrResult.confidence,
    structuredData: classification.extractedData as Record<string, unknown>,
    isSearchable: ocrResult.text.length > 0,
    metadata: {
      scanDate: new Date().toISOString(),
      pageCount: request.pages.length,
      classificationConfidence: classification.confidence,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Store document
  await storeDocument(document);

  // Index for search
  if (document.isSearchable) {
    indexDocument(document.id, ocrResult.text);
  }

  // Handle special document types
  let linkedEntity: ScanResult['linkedEntity'] | undefined;

  if (classification.documentType === 'business_card' && classification.extractedData) {
    const contact = await createContactFromBusinessCard(
      request.customerId,
      classification.extractedData as BusinessCardData
    );
    if (contact) {
      document.linkedContactId = contact.id;
      linkedEntity = { type: 'contact', id: contact.id, name: contact.name };
      await updateDocument(documentId, { linkedContactId: contact.id });
    }
  }

  if (classification.documentType === 'contract' && request.customerId) {
    // Trigger contract parsing workflow (could be async)
    await triggerContractParsing(documentId, request.customerId);
  }

  return {
    document,
    classification,
    ocrResult,
    linkedEntity,
  };
}

// ============================================
// Storage Operations
// ============================================

async function storeDocument(document: ScannedDocument): Promise<void> {
  if (supabase) {
    await supabase.from('scanned_documents').insert({
      id: document.id,
      user_id: document.userId,
      customer_id: document.customerId,
      customer_name: document.customerName,
      file_name: document.fileName,
      document_type: document.documentType,
      page_count: document.pageCount,
      extracted_text: document.extractedText,
      ocr_confidence: document.ocrConfidence,
      structured_data: document.structuredData,
      file_url: document.fileUrl,
      thumbnail_url: document.thumbnailUrl,
      is_searchable: document.isSearchable,
      linked_contact_id: document.linkedContactId,
      linked_contract_id: document.linkedContractId,
      metadata: document.metadata,
      created_at: document.createdAt.toISOString(),
      updated_at: document.updatedAt.toISOString(),
    });
  } else {
    documentStore.set(document.id, document);
  }
}

async function updateDocument(
  documentId: string,
  updates: Partial<ScannedDocument>
): Promise<void> {
  if (supabase) {
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.linkedContactId) dbUpdates.linked_contact_id = updates.linkedContactId;
    if (updates.linkedContractId) dbUpdates.linked_contract_id = updates.linkedContractId;
    if (updates.fileUrl) dbUpdates.file_url = updates.fileUrl;
    if (updates.thumbnailUrl) dbUpdates.thumbnail_url = updates.thumbnailUrl;

    await supabase
      .from('scanned_documents')
      .update(dbUpdates)
      .eq('id', documentId);
  } else {
    const doc = documentStore.get(documentId);
    if (doc) {
      documentStore.set(documentId, { ...doc, ...updates, updatedAt: new Date() });
    }
  }
}

// ============================================
// Search & Retrieval
// ============================================

/**
 * Search scanned documents by text content
 */
export async function searchDocuments(
  userId: string,
  query: string,
  options: {
    customerId?: string;
    documentType?: DocumentType;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ documents: ScannedDocument[]; total: number }> {
  const { customerId, documentType, limit = 20, offset = 0 } = options;

  if (supabase) {
    let dbQuery = supabase
      .from('scanned_documents')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_searchable', true);

    if (customerId) {
      dbQuery = dbQuery.eq('customer_id', customerId);
    }
    if (documentType) {
      dbQuery = dbQuery.eq('document_type', documentType);
    }
    if (query) {
      dbQuery = dbQuery.ilike('extracted_text', `%${query}%`);
    }

    const { data, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Search error:', error);
      return { documents: [], total: 0 };
    }

    return {
      documents: (data || []).map(transformDbDocument),
      total: count || 0,
    };
  }

  // In-memory search
  const words = query.toLowerCase().split(/\s+/);
  const matchingIds = new Set<string>();

  for (const word of words) {
    const ids = searchIndex.get(word);
    if (ids) {
      for (const id of ids) {
        matchingIds.add(id);
      }
    }
  }

  let results = Array.from(matchingIds)
    .map(id => documentStore.get(id))
    .filter((doc): doc is ScannedDocument => !!doc && doc.userId === userId);

  if (customerId) {
    results = results.filter(doc => doc.customerId === customerId);
  }
  if (documentType) {
    results = results.filter(doc => doc.documentType === documentType);
  }

  return {
    documents: results.slice(offset, offset + limit),
    total: results.length,
  };
}

/**
 * Get document by ID
 */
export async function getDocumentById(documentId: string): Promise<ScannedDocument | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('scanned_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error || !data) return null;
    return transformDbDocument(data);
  }

  return documentStore.get(documentId) || null;
}

/**
 * Get documents for a customer
 */
export async function getCustomerDocuments(
  customerId: string,
  options: {
    documentType?: DocumentType;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ documents: ScannedDocument[]; total: number }> {
  const { documentType, limit = 50, offset = 0 } = options;

  if (supabase) {
    let query = supabase
      .from('scanned_documents')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId);

    if (documentType) {
      query = query.eq('document_type', documentType);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { documents: [], total: 0 };
    }

    return {
      documents: (data || []).map(transformDbDocument),
      total: count || 0,
    };
  }

  let results = Array.from(documentStore.values())
    .filter(doc => doc.customerId === customerId);

  if (documentType) {
    results = results.filter(doc => doc.documentType === documentType);
  }

  return {
    documents: results.slice(offset, offset + limit),
    total: results.length,
  };
}

/**
 * Delete a scanned document
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase
      .from('scanned_documents')
      .delete()
      .eq('id', documentId);

    return !error;
  }

  return documentStore.delete(documentId);
}

// ============================================
// Helper Functions
// ============================================

function indexDocument(documentId: string, text: string): void {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);

  for (const word of words) {
    if (!searchIndex.has(word)) {
      searchIndex.set(word, new Set());
    }
    searchIndex.get(word)!.add(documentId);
  }
}

function transformDbDocument(data: Record<string, unknown>): ScannedDocument {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    customerId: data.customer_id as string | undefined,
    customerName: data.customer_name as string | undefined,
    fileName: data.file_name as string,
    documentType: data.document_type as DocumentType,
    pageCount: data.page_count as number,
    extractedText: data.extracted_text as string,
    ocrConfidence: data.ocr_confidence as number,
    structuredData: data.structured_data as Record<string, unknown>,
    fileUrl: data.file_url as string | undefined,
    thumbnailUrl: data.thumbnail_url as string | undefined,
    isSearchable: data.is_searchable as boolean,
    linkedContactId: data.linked_contact_id as string | undefined,
    linkedContractId: data.linked_contract_id as string | undefined,
    metadata: data.metadata as Record<string, unknown>,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

async function createContactFromBusinessCard(
  customerId: string | undefined,
  data: BusinessCardData
): Promise<{ id: string; name: string } | null> {
  if (!data.name) return null;

  const contactId = uuidv4();

  if (supabase && customerId) {
    try {
      await supabase.from('contacts').insert({
        id: contactId,
        customer_id: customerId,
        name: data.name,
        title: data.title,
        email: data.email,
        phone: data.phone,
        company: data.company,
        linkedin_url: data.linkedinUrl,
        website: data.website,
        source: 'scanned_business_card',
        created_at: new Date().toISOString(),
      });

      return { id: contactId, name: data.name };
    } catch (error) {
      console.error('Failed to create contact:', error);
      return null;
    }
  }

  return { id: contactId, name: data.name };
}

async function triggerContractParsing(
  documentId: string,
  customerId: string
): Promise<void> {
  // This could trigger an async workflow to parse the contract
  // For now, we'll just log it
  console.log(`Contract parsing triggered for document ${documentId}, customer ${customerId}`);

  // In a real implementation, this would:
  // 1. Queue a background job
  // 2. Use the contract parsing service to extract terms
  // 3. Update the customer's contract records
}

// ============================================
// Statistics
// ============================================

/**
 * Get scanning statistics for a user
 */
export async function getScanStats(userId: string): Promise<{
  totalScans: number;
  byType: Record<DocumentType, number>;
  avgConfidence: number;
  recentScans: number;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (supabase) {
    const { data } = await supabase
      .from('scanned_documents')
      .select('document_type, ocr_confidence, created_at')
      .eq('user_id', userId);

    if (!data || data.length === 0) {
      return {
        totalScans: 0,
        byType: { contract: 0, business_card: 0, meeting_notes: 0, invoice: 0, other: 0 },
        avgConfidence: 0,
        recentScans: 0,
      };
    }

    const byType: Record<DocumentType, number> = {
      contract: 0,
      business_card: 0,
      meeting_notes: 0,
      invoice: 0,
      other: 0,
    };

    let totalConfidence = 0;
    let recentScans = 0;

    for (const doc of data) {
      byType[doc.document_type as DocumentType]++;
      totalConfidence += doc.ocr_confidence || 0;
      if (new Date(doc.created_at) >= thirtyDaysAgo) {
        recentScans++;
      }
    }

    return {
      totalScans: data.length,
      byType,
      avgConfidence: data.length > 0 ? totalConfidence / data.length : 0,
      recentScans,
    };
  }

  // In-memory fallback
  const docs = Array.from(documentStore.values()).filter(d => d.userId === userId);
  const byType: Record<DocumentType, number> = {
    contract: 0,
    business_card: 0,
    meeting_notes: 0,
    invoice: 0,
    other: 0,
  };

  let totalConfidence = 0;
  let recentScans = 0;

  for (const doc of docs) {
    byType[doc.documentType]++;
    totalConfidence += doc.ocrConfidence;
    if (doc.createdAt >= thirtyDaysAgo) {
      recentScans++;
    }
  }

  return {
    totalScans: docs.length,
    byType,
    avgConfidence: docs.length > 0 ? totalConfidence / docs.length : 0,
    recentScans,
  };
}

// ============================================
// Exports
// ============================================

export default {
  processScannedDocument,
  performOCR,
  classifyDocument,
  searchDocuments,
  getDocumentById,
  getCustomerDocuments,
  deleteDocument,
  getScanStats,
};
