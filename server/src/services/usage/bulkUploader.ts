/**
 * Bulk Uploader Service
 * PRD-006: Process bulk usage file uploads
 *
 * Features:
 * - File upload and validation
 * - Platform detection and parsing
 * - Column mapping confirmation
 * - Batch event ingestion
 * - Progress tracking
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { platformParsers, ParsedUsageData, UsageColumnMapping, AnalyticsPlatform } from './platformParsers.js';
import { ingestUsageEvents, type UsageEvent } from './calculator.js';
import { adoptionScoringService } from '../analysis/adoptionScoring.js';

// ============================================
// TYPES
// ============================================

export interface BulkUploadResult {
  uploadId: string;
  status: 'pending' | 'parsing' | 'parsed' | 'processing' | 'completed' | 'failed';
  platform: AnalyticsPlatform;
  summary: {
    totalEvents: number;
    uniqueCustomers: number;
    uniqueUsers: number;
    featuresTracked: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
  columnMapping: UsageColumnMapping;
  previewData: Array<{
    customerId: string;
    customerName: string;
    eventCount: number;
    features: string[];
  }>;
  errors: string[];
}

export interface BulkUploadProgress {
  uploadId: string;
  status: 'pending' | 'parsing' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  processedEvents: number;
  totalEvents: number;
  processedCustomers: number;
  totalCustomers: number;
  currentStep: string;
  errors: string[];
}

export interface ProcessingResult {
  uploadId: string;
  success: boolean;
  customersProcessed: number;
  eventsIngested: number;
  adoptionScoresCalculated: number;
  healthScoresUpdated: number;
  errors: string[];
  duration: number; // milliseconds
}

// ============================================
// BULK UPLOADER SERVICE
// ============================================

class BulkUploaderService {
  private supabase: SupabaseClient | null = null;
  private uploadCache: Map<string, ParsedUsageData> = new Map();
  private progressCache: Map<string, BulkUploadProgress> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Upload and parse a usage data file
   */
  async uploadUsageFile(
    userId: string,
    fileContent: Buffer | string,
    fileName: string,
    suggestedPlatform?: AnalyticsPlatform,
    customMapping?: Partial<UsageColumnMapping>
  ): Promise<BulkUploadResult> {
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    try {
      // Parse the file
      const parsedData = await platformParsers.parseUsageData(
        fileContent,
        suggestedPlatform,
        customMapping
      );

      // Validate the parsed data
      const validation = platformParsers.validateParsedData(parsedData);
      if (!validation.valid) {
        return {
          uploadId,
          status: 'failed',
          platform: parsedData.platform,
          summary: {
            totalEvents: 0,
            uniqueCustomers: 0,
            uniqueUsers: 0,
            featuresTracked: 0,
            dateRange: {
              start: new Date().toISOString(),
              end: new Date().toISOString(),
            },
          },
          columnMapping: parsedData.columnMapping,
          previewData: [],
          errors: validation.errors,
        };
      }

      // Cache the parsed data for later processing
      this.uploadCache.set(uploadId, parsedData);

      // Generate preview data (aggregate by customer)
      const customerAggregates = this.aggregateByCustomer(parsedData);
      const previewData = customerAggregates.slice(0, 10);

      // Save upload record to database
      if (this.supabase) {
        await this.saveUploadRecord(uploadId, userId, fileName, parsedData);
      }

      return {
        uploadId,
        status: 'parsed',
        platform: parsedData.platform,
        summary: {
          totalEvents: parsedData.totalEvents,
          uniqueCustomers: parsedData.uniqueCustomers,
          uniqueUsers: parsedData.uniqueUsers,
          featuresTracked: parsedData.uniqueFeatures,
          dateRange: {
            start: parsedData.dateRange.start.toISOString(),
            end: parsedData.dateRange.end.toISOString(),
          },
        },
        columnMapping: parsedData.columnMapping,
        previewData,
        errors: [],
      };
    } catch (err) {
      console.error('Failed to parse usage file:', err);
      return {
        uploadId,
        status: 'failed',
        platform: 'generic',
        summary: {
          totalEvents: 0,
          uniqueCustomers: 0,
          uniqueUsers: 0,
          featuresTracked: 0,
          dateRange: {
            start: new Date().toISOString(),
            end: new Date().toISOString(),
          },
        },
        columnMapping: {},
        previewData: [],
        errors: [err instanceof Error ? err.message : 'Failed to parse file'],
      };
    }
  }

  /**
   * Update column mapping for an upload
   */
  async updateColumnMapping(
    uploadId: string,
    newMapping: Partial<UsageColumnMapping>
  ): Promise<BulkUploadResult | null> {
    const cachedData = this.uploadCache.get(uploadId);
    if (!cachedData) {
      return null;
    }

    // Re-parse with new mapping (would need the original file content)
    // For now, just update the mapping in cache
    const updatedMapping = { ...cachedData.columnMapping, ...newMapping };

    // Return updated result
    const customerAggregates = this.aggregateByCustomer(cachedData);

    return {
      uploadId,
      status: 'parsed',
      platform: cachedData.platform,
      summary: {
        totalEvents: cachedData.totalEvents,
        uniqueCustomers: cachedData.uniqueCustomers,
        uniqueUsers: cachedData.uniqueUsers,
        featuresTracked: cachedData.uniqueFeatures,
        dateRange: {
          start: cachedData.dateRange.start.toISOString(),
          end: cachedData.dateRange.end.toISOString(),
        },
      },
      columnMapping: updatedMapping,
      previewData: customerAggregates.slice(0, 10),
      errors: [],
    };
  }

  /**
   * Process the uploaded usage data
   */
  async processUpload(uploadId: string): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let customersProcessed = 0;
    let eventsIngested = 0;
    let adoptionScoresCalculated = 0;
    let healthScoresUpdated = 0;

    try {
      const parsedData = this.uploadCache.get(uploadId);
      if (!parsedData) {
        return {
          uploadId,
          success: false,
          customersProcessed: 0,
          eventsIngested: 0,
          adoptionScoresCalculated: 0,
          healthScoresUpdated: 0,
          errors: ['Upload not found. Please re-upload the file.'],
          duration: Date.now() - startTime,
        };
      }

      // Initialize progress tracking
      const customerIds = new Set(parsedData.rows.map(r => r.customerId));
      this.progressCache.set(uploadId, {
        uploadId,
        status: 'processing',
        progress: 0,
        processedEvents: 0,
        totalEvents: parsedData.totalEvents,
        processedCustomers: 0,
        totalCustomers: customerIds.size,
        currentStep: 'Starting processing...',
        errors: [],
      });

      // Update database status
      if (this.supabase) {
        await this.updateUploadStatus(uploadId, 'processing');
      }

      // Group events by customer
      const eventsByCustomer = this.groupByCustomer(parsedData);

      // Process each customer
      let processedCount = 0;
      for (const [customerId, events] of eventsByCustomer.entries()) {
        try {
          // Convert to UsageEvent format
          const usageEvents: UsageEvent[] = events.map(e => ({
            event_type: 'feature_used',
            event_name: e.featureName,
            user_id: e.userId,
            user_email: e.userEmail,
            metadata: {
              duration: e.duration,
              source: 'bulk_upload',
              uploadId,
            },
            timestamp: e.timestamp.toISOString(),
          }));

          // Ingest events
          const result = await ingestUsageEvents(customerId, usageEvents);
          eventsIngested += result.ingested;

          if (result.healthScoreUpdated) {
            healthScoresUpdated++;
          }

          customersProcessed++;
        } catch (err) {
          errors.push(`Failed to process customer ${customerId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }

        // Update progress
        processedCount++;
        this.updateProgress(uploadId, {
          progress: Math.round((processedCount / eventsByCustomer.size) * 80),
          processedEvents: eventsIngested,
          processedCustomers: processedCount,
          currentStep: `Processing customer ${processedCount}/${eventsByCustomer.size}`,
        });
      }

      // Calculate adoption scores
      this.updateProgress(uploadId, {
        progress: 85,
        currentStep: 'Calculating adoption scores...',
      });

      const adoptionResults = await adoptionScoringService.calculateBulkAdoptionScores(
        Array.from(customerIds),
        parsedData.featuresTracked
      );
      adoptionScoresCalculated = adoptionResults.length;

      // Update database status
      if (this.supabase) {
        await this.updateUploadStatus(uploadId, 'completed');
      }

      // Update final progress
      this.updateProgress(uploadId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Processing complete',
      });

      // Clean up cache
      this.uploadCache.delete(uploadId);

      return {
        uploadId,
        success: errors.length === 0,
        customersProcessed,
        eventsIngested,
        adoptionScoresCalculated,
        healthScoresUpdated,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      console.error('Failed to process upload:', err);

      if (this.supabase) {
        await this.updateUploadStatus(uploadId, 'failed');
      }

      this.updateProgress(uploadId, {
        status: 'failed',
        currentStep: 'Processing failed',
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      });

      return {
        uploadId,
        success: false,
        customersProcessed,
        eventsIngested,
        adoptionScoresCalculated,
        healthScoresUpdated,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get upload progress
   */
  getProgress(uploadId: string): BulkUploadProgress | null {
    return this.progressCache.get(uploadId) || null;
  }

  /**
   * Aggregate parsed data by customer for preview
   */
  private aggregateByCustomer(data: ParsedUsageData): Array<{
    customerId: string;
    customerName: string;
    eventCount: number;
    features: string[];
  }> {
    const customerMap = new Map<string, {
      customerId: string;
      customerName: string;
      eventCount: number;
      features: Set<string>;
    }>();

    for (const row of data.rows) {
      const existing = customerMap.get(row.customerId);
      if (existing) {
        existing.eventCount++;
        existing.features.add(row.featureName);
      } else {
        customerMap.set(row.customerId, {
          customerId: row.customerId,
          customerName: row.customerName,
          eventCount: 1,
          features: new Set([row.featureName]),
        });
      }
    }

    return Array.from(customerMap.values())
      .map(c => ({
        customerId: c.customerId,
        customerName: c.customerName,
        eventCount: c.eventCount,
        features: Array.from(c.features),
      }))
      .sort((a, b) => b.eventCount - a.eventCount);
  }

  /**
   * Group parsed data by customer
   */
  private groupByCustomer(data: ParsedUsageData): Map<string, typeof data.rows> {
    const groups = new Map<string, typeof data.rows>();

    for (const row of data.rows) {
      const existing = groups.get(row.customerId) || [];
      existing.push(row);
      groups.set(row.customerId, existing);
    }

    return groups;
  }

  /**
   * Update progress in cache
   */
  private updateProgress(uploadId: string, updates: Partial<BulkUploadProgress>): void {
    const current = this.progressCache.get(uploadId);
    if (current) {
      this.progressCache.set(uploadId, { ...current, ...updates });
    }
  }

  /**
   * Save upload record to database
   */
  private async saveUploadRecord(
    uploadId: string,
    userId: string,
    fileName: string,
    data: ParsedUsageData
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('usage_bulk_uploads').insert({
      id: uploadId,
      user_id: userId,
      file_name: fileName,
      status: 'parsed',
      platform: data.platform,
      total_events: data.totalEvents,
      unique_customers: data.uniqueCustomers,
      unique_users: data.uniqueUsers,
      features_tracked: data.featuresTracked,
      date_range_start: data.dateRange.start.toISOString(),
      date_range_end: data.dateRange.end.toISOString(),
      column_mapping: data.columnMapping,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Update upload status in database
   */
  private async updateUploadStatus(
    uploadId: string,
    status: 'pending' | 'parsing' | 'parsed' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    if (!this.supabase) return;

    const updates: Record<string, any> = { status };
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    await this.supabase
      .from('usage_bulk_uploads')
      .update(updates)
      .eq('id', uploadId);
  }

  /**
   * Get recent uploads for a user
   */
  async getRecentUploads(userId: string, limit: number = 10): Promise<any[]> {
    if (!this.supabase) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('usage_bulk_uploads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get recent uploads:', error);
      return [];
    }

    return data || [];
  }
}

// Singleton instance
export const bulkUploaderService = new BulkUploaderService();
export default bulkUploaderService;
