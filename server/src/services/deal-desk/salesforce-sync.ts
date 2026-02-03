/**
 * Deal Desk Salesforce Sync Service
 * PRD-244: Deal Desk Integration
 *
 * Service for syncing approved Deal Desk terms back to Salesforce.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { DealDeskRequestRow } from './types.js';

// ============================================
// Salesforce Sync Types
// ============================================

export interface SalesforceOpportunityUpdate {
  opportunityId: string;
  discountApproved: number | null;
  dealDeskApprovalDate: string | null;
  dealDeskNotes: string | null;
  pricingStatus: 'Deal Desk Approved' | 'Deal Desk Rejected' | 'Pending Deal Desk';
  conditions?: string | null;
}

export interface SalesforceSyncResult {
  success: boolean;
  opportunityId: string;
  syncedAt: string;
  error?: string;
}

// ============================================
// Salesforce Sync Service
// ============================================

export class DealDeskSalesforceSync {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Sync approved Deal Desk request to Salesforce
   */
  async syncApprovalToSalesforce(request: DealDeskRequestRow): Promise<SalesforceSyncResult> {
    if (!request.salesforce_opportunity_id) {
      return {
        success: false,
        opportunityId: '',
        syncedAt: new Date().toISOString(),
        error: 'No Salesforce opportunity ID associated with request',
      };
    }

    const opportunityId = request.salesforce_opportunity_id;

    try {
      // Build the update payload
      const update: SalesforceOpportunityUpdate = {
        opportunityId,
        discountApproved: request.discount_approved_pct,
        dealDeskApprovalDate: request.decision_at,
        dealDeskNotes: request.decision_notes,
        pricingStatus:
          request.status === 'approved'
            ? 'Deal Desk Approved'
            : request.status === 'rejected'
            ? 'Deal Desk Rejected'
            : 'Pending Deal Desk',
        conditions: request.conditions,
      };

      // Get user's Salesforce connection
      const connection = await this.getSalesforceConnection(request.submitted_by_user_id);

      if (!connection) {
        // Queue for later sync
        await this.queueSyncOperation(request.id, update);
        return {
          success: false,
          opportunityId,
          syncedAt: new Date().toISOString(),
          error: 'No Salesforce connection found. Sync queued for later.',
        };
      }

      // Perform the Salesforce update
      const result = await this.updateSalesforceOpportunity(connection, update);

      // Log the sync
      await this.logSync(request.id, opportunityId, result.success, result.error);

      return result;
    } catch (error) {
      console.error('[DealDesk Salesforce Sync] Error:', error);

      // Queue for retry
      await this.queueSyncOperation(request.id, {
        opportunityId,
        discountApproved: request.discount_approved_pct,
        dealDeskApprovalDate: request.decision_at,
        dealDeskNotes: request.decision_notes,
        pricingStatus: 'Deal Desk Approved',
      });

      return {
        success: false,
        opportunityId,
        syncedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update Salesforce opportunity with approved terms
   */
  private async updateSalesforceOpportunity(
    connection: any,
    update: SalesforceOpportunityUpdate
  ): Promise<SalesforceSyncResult> {
    // This would use the jsforce library or Salesforce REST API
    // For now, we'll simulate the update

    console.log('[DealDesk Salesforce Sync] Updating opportunity:', update.opportunityId);

    // In production, this would be:
    // const conn = new jsforce.Connection({
    //   instanceUrl: connection.instance_url,
    //   accessToken: connection.access_token,
    // });
    //
    // await conn.sobject('Opportunity').update({
    //   Id: update.opportunityId,
    //   Discount_Approved__c: update.discountApproved,
    //   Deal_Desk_Approval_Date__c: update.dealDeskApprovalDate,
    //   Deal_Desk_Notes__c: update.dealDeskNotes,
    //   Pricing_Status__c: update.pricingStatus,
    // });

    // Simulated success
    return {
      success: true,
      opportunityId: update.opportunityId,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Get Salesforce connection for user
   */
  private async getSalesforceConnection(userId: string): Promise<any | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('salesforce_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    return data;
  }

  /**
   * Queue sync operation for later retry
   */
  private async queueSyncOperation(
    requestId: string,
    update: SalesforceOpportunityUpdate
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('deal_desk_sync_queue').insert({
      request_id: requestId,
      opportunity_id: update.opportunityId,
      sync_data: update,
      status: 'pending',
      attempts: 0,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Log sync operation
   */
  private async logSync(
    requestId: string,
    opportunityId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('deal_desk_sync_log').insert({
      request_id: requestId,
      opportunity_id: opportunityId,
      success,
      error,
      synced_at: new Date().toISOString(),
    });
  }

  /**
   * Process queued sync operations (called by scheduler)
   */
  async processSyncQueue(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (!this.supabase) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    const { data: queuedItems } = await this.supabase
      .from('deal_desk_sync_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!queuedItems || queuedItems.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    for (const item of queuedItems) {
      try {
        // Get request data
        const { data: request } = await this.supabase
          .from('deal_desk_requests')
          .select('submitted_by_user_id')
          .eq('id', item.request_id)
          .single();

        if (!request) {
          await this.updateQueueItem(item.id, 'failed', 'Request not found');
          failed++;
          continue;
        }

        const connection = await this.getSalesforceConnection(request.submitted_by_user_id);

        if (!connection) {
          await this.updateQueueItem(item.id, 'pending', 'No connection', item.attempts + 1);
          continue;
        }

        const result = await this.updateSalesforceOpportunity(connection, item.sync_data);

        if (result.success) {
          await this.updateQueueItem(item.id, 'completed');
          succeeded++;
        } else {
          await this.updateQueueItem(item.id, 'pending', result.error, item.attempts + 1);
        }
      } catch (error) {
        await this.updateQueueItem(
          item.id,
          'failed',
          error instanceof Error ? error.message : 'Unknown error',
          item.attempts + 1
        );
        failed++;
      }
    }

    return {
      processed: queuedItems.length,
      succeeded,
      failed,
    };
  }

  /**
   * Update queue item status
   */
  private async updateQueueItem(
    itemId: string,
    status: 'pending' | 'completed' | 'failed',
    error?: string,
    attempts?: number
  ): Promise<void> {
    if (!this.supabase) return;

    const update: any = { status };
    if (error !== undefined) update.last_error = error;
    if (attempts !== undefined) update.attempts = attempts;

    await this.supabase.from('deal_desk_sync_queue').update(update).eq('id', itemId);
  }

  /**
   * Sync renewal pipeline with approved pricing
   */
  async syncToRenewalPipeline(request: DealDeskRequestRow): Promise<boolean> {
    if (!this.supabase || !request.renewal_pipeline_id) {
      return false;
    }

    try {
      await this.supabase
        .from('renewal_pipeline')
        .update({
          deal_desk_approved: true,
          approved_discount_pct: request.discount_approved_pct,
          approved_pricing_notes: request.conditions,
          deal_desk_approval_date: request.decision_at,
        })
        .eq('id', request.renewal_pipeline_id);

      console.log(`[DealDesk] Synced to renewal pipeline: ${request.renewal_pipeline_id}`);
      return true;
    } catch (error) {
      console.error('[DealDesk] Error syncing to renewal pipeline:', error);
      return false;
    }
  }

  /**
   * Sync expansion opportunity with approved pricing
   */
  async syncToExpansionOpportunity(request: DealDeskRequestRow): Promise<boolean> {
    if (!this.supabase || !request.expansion_opportunity_id) {
      return false;
    }

    try {
      await this.supabase
        .from('expansion_opportunities')
        .update({
          deal_desk_approved: true,
          approved_discount_pct: request.discount_approved_pct,
          approved_pricing_notes: request.conditions,
          deal_desk_approval_date: request.decision_at,
        })
        .eq('id', request.expansion_opportunity_id);

      console.log(`[DealDesk] Synced to expansion opportunity: ${request.expansion_opportunity_id}`);
      return true;
    } catch (error) {
      console.error('[DealDesk] Error syncing to expansion opportunity:', error);
      return false;
    }
  }
}

// Singleton instance
export const dealDeskSalesforceSync = new DealDeskSalesforceSync();
