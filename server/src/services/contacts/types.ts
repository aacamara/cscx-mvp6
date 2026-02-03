/**
 * Contact Import Types (PRD-025)
 * Type definitions for bulk contact upload and enrichment
 */

// ============================================
// Core Contact Types
// ============================================

export interface RawContact {
  name: string;
  email?: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedinUrl?: string;
  department?: string;
  notes?: string;
  [key: string]: string | undefined;
}

export interface ParsedContact extends RawContact {
  rowIndex: number;
  originalData: Record<string, any>;
}

export interface EnrichedContact extends ParsedContact {
  // Enrichment data
  fullTitle?: string;
  seniority?: 'Executive' | 'Director' | 'Manager' | 'Individual' | 'Unknown';
  department?: string;
  companySize?: number;
  industry?: string;
  enrichedLinkedinUrl?: string;

  // Derived scores
  contactQualityScore: number;
  qualityLevel: 'Complete' | 'Good' | 'Fair' | 'Basic';

  // Customer matching
  matchedCustomerId?: string;
  matchedCustomerName?: string;
  matchConfidence?: number;

  // Enrichment metadata
  enrichmentSuccess: boolean;
  enrichmentErrors?: string[];
  enrichedAt?: Date;
}

export interface StakeholderRecord {
  id: string;
  customerId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  isPrimary: boolean;
  isChampion: boolean;
  isExecSponsor: boolean;
  status: 'active' | 'departed' | 'unknown';
  engagementScore: number;
  interactionCount: number;
  notes?: string;
  seniority?: string;
  department?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Upload & Parsing Types
// ============================================

export interface ContactUploadResult {
  uploadId: string;
  fileName: string;
  totalContacts: number;
  parsedContacts: ParsedContact[];
  customerMatches: CustomerMatch[];
  unknownCompanies: string[];
  headers: string[];
  columnMapping: ContactColumnMapping;
  suggestedMappings: SuggestedMapping[];
  parseErrors: ParseError[];
}

export interface ContactColumnMapping {
  name?: string;
  email?: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedinUrl?: string;
  department?: string;
  notes?: string;
  [key: string]: string | undefined;
}

export interface SuggestedMapping {
  column: string;
  suggestedField: keyof ContactColumnMapping;
  confidence: number;
}

export interface CustomerMatch {
  company: string;
  customerId: string;
  customerName: string;
  contactCount: number;
}

export interface ParseError {
  rowIndex: number;
  column?: string;
  error: string;
}

// ============================================
// Deduplication Types
// ============================================

export interface DeduplicationResult {
  newContacts: ParsedContact[];
  existingUnchanged: ExistingContact[];
  existingUpdateable: UpdateableContact[];
  potentialDuplicates: DuplicateCandidate[];
  summary: DeduplicationSummary;
}

export interface DeduplicationSummary {
  totalProcessed: number;
  newCount: number;
  existingUnchangedCount: number;
  existingUpdateableCount: number;
  duplicateCount: number;
}

export interface ExistingContact {
  uploadedContact: ParsedContact;
  existingStakeholder: StakeholderRecord;
  matchType: 'exact_email' | 'exact_name' | 'exact_linkedin';
}

export interface UpdateableContact extends ExistingContact {
  updatableFields: string[];
  newValues: Record<string, any>;
}

export interface DuplicateCandidate {
  uploadedContact: ParsedContact;
  existingStakeholder: StakeholderRecord;
  confidence: number;
  matchReasons: string[];
  fieldComparison: FieldComparison[];
}

export interface FieldComparison {
  field: string;
  uploadedValue: string | null;
  existingValue: string | null;
  similarity: number;
}

// ============================================
// Enrichment Types
// ============================================

export interface EnrichmentResult {
  enrichedContacts: EnrichedContact[];
  summary: EnrichmentSummary;
  seniorityBreakdown: SeniorityBreakdown[];
  customerBreakdown: CustomerContactBreakdown[];
  highValueContacts: HighValueContact[];
}

export interface EnrichmentSummary {
  totalProcessed: number;
  successRate: number;
  dataPoints: EnrichmentDataPoint[];
}

export interface EnrichmentDataPoint {
  name: string;
  found: number;
  notFound: number;
}

export interface SeniorityBreakdown {
  level: EnrichedContact['seniority'];
  count: number;
  examples: string[];
}

export interface CustomerContactBreakdown {
  customerId: string;
  customerName: string;
  newContactCount: number;
  keyAdditions: string[];
}

export interface HighValueContact {
  contact: EnrichedContact;
  title: string;
  customerName: string;
  opportunity: string;
}

// ============================================
// Import Types
// ============================================

export interface ImportRequest {
  uploadId: string;
  contactsToImport: ImportContactDecision[];
  duplicateResolutions: DuplicateResolution[];
}

export interface ImportContactDecision {
  rowIndex: number;
  action: 'import' | 'skip';
  customerId?: string;
}

export interface DuplicateResolution {
  rowIndex: number;
  existingStakeholderId: string;
  action: 'merge' | 'keep_both' | 'skip';
  mergeStrategy?: 'uploaded_wins' | 'existing_wins' | 'newest_wins';
}

export interface ImportResult {
  success: boolean;
  summary: ImportSummary;
  createdStakeholders: StakeholderRecord[];
  updatedStakeholders: StakeholderRecord[];
  mergedStakeholders: MergedStakeholder[];
  skippedCount: number;
  errors: ImportError[];
  recommendations: ImportRecommendation[];
}

export interface ImportSummary {
  created: number;
  updated: number;
  merged: number;
  skipped: number;
  errors: number;
}

export interface MergedStakeholder {
  stakeholder: StakeholderRecord;
  mergedFromRowIndex: number;
  fieldsUpdated: string[];
}

export interface ImportError {
  rowIndex: number;
  contactName: string;
  error: string;
}

export interface ImportRecommendation {
  type: 'new_executive' | 'manual_review' | 'missing_data';
  title: string;
  description: string;
  contacts?: EnrichedContact[];
  actionLabel?: string;
}

// ============================================
// Contact Import Job Types
// ============================================

export interface ContactImportJob {
  id: string;
  userId: string;
  fileName: string;
  status: ContactImportStatus;
  totalContacts: number;
  processedContacts: number;
  uploadResult?: ContactUploadResult;
  deduplicationResult?: DeduplicationResult;
  enrichmentResult?: EnrichmentResult;
  importResult?: ImportResult;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export type ContactImportStatus =
  | 'uploading'
  | 'parsing'
  | 'mapping'
  | 'deduplicating'
  | 'enriching'
  | 'reviewing'
  | 'importing'
  | 'completed'
  | 'failed';
