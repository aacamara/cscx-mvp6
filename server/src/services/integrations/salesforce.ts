/**
 * Salesforce Integration Service
 *
 * Handles OAuth2 authentication and data sync with Salesforce CRM.
 * Supports bi-directional sync of accounts, contacts, and custom fields.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export interface SalesforceConnection {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  tokenExpiresAt: Date;
}

export interface SalesforceAccount {
  Id: string;
  Name: string;
  AnnualRevenue?: number;
  Industry?: string;
  Website?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingCountry?: string;
  Health_Score__c?: number;
  Stage__c?: string;
  Renewal_Date__c?: string;
}

export interface SalesforceContact {
  Id: string;
  AccountId: string;
  FirstName: string;
  LastName: string;
  Email?: string;
  Title?: string;
  Phone?: string;
  Is_Champion__c?: boolean;
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

export interface FieldMapping {
  salesforceField: string;
  cscxField: string;
  direction: 'salesforce_to_cscx' | 'cscx_to_salesforce' | 'bidirectional';
}

const DEFAULT_FIELD_MAPPINGS: FieldMapping[] = [
  { salesforceField: 'Name', cscxField: 'name', direction: 'bidirectional' },
  { salesforceField: 'AnnualRevenue', cscxField: 'arr', direction: 'bidirectional' },
  { salesforceField: 'Industry', cscxField: 'industry', direction: 'salesforce_to_cscx' },
  { salesforceField: 'Health_Score__c', cscxField: 'health_score', direction: 'cscx_to_salesforce' },
  { salesforceField: 'Stage__c', cscxField: 'stage', direction: 'bidirectional' },
  { salesforceField: 'Renewal_Date__c', cscxField: 'renewal_date', direction: 'bidirectional' },
];

export class SalesforceService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.SALESFORCE_CLIENT_ID || '';
    this.clientSecret = process.env.SALESFORCE_CLIENT_SECRET || '';
    this.redirectUri = process.env.SALESFORCE_REDIRECT_URI || 'http://localhost:3001/api/integrations/salesforce/callback';
  }

  /**
   * Check if Salesforce integration is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(state?: string): string {
    const baseUrl = 'https://login.salesforce.com/services/oauth2/authorize';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'api refresh_token offline_access',
      ...(state && { state }),
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async connect(code: string): Promise<SalesforceConnection> {
    const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce OAuth failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      instanceUrl: data.instance_url,
      tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours default
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<SalesforceConnection> {
    const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Salesforce token');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Refresh token doesn't change
      instanceUrl: data.instance_url,
      tokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    };
  }

  /**
   * Execute SOQL query
   */
  async query<T>(connection: SalesforceConnection, soql: string): Promise<T[]> {
    const url = `${connection.instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent(soql)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce query failed: ${error}`);
    }

    const data = await response.json();
    return data.records as T[];
  }

  /**
   * Update a Salesforce record
   */
  async updateRecord(
    connection: SalesforceConnection,
    objectType: string,
    recordId: string,
    fields: Record<string, unknown>
  ): Promise<boolean> {
    const url = `${connection.instanceUrl}/services/data/v58.0/sobjects/${objectType}/${recordId}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fields),
    });

    return response.ok;
  }

  /**
   * Sync accounts from Salesforce to CSCX
   */
  async syncAccounts(
    connection: SalesforceConnection,
    userId: string,
    fieldMappings: FieldMapping[] = DEFAULT_FIELD_MAPPINGS
  ): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    if (!supabase) {
      result.errors.push('Database not configured');
      return result;
    }

    try {
      // Build SOQL query based on field mappings
      const salesforceFields = fieldMappings
        .filter(m => m.direction !== 'cscx_to_salesforce')
        .map(m => m.salesforceField);

      const soql = `SELECT Id, ${salesforceFields.join(', ')} FROM Account WHERE IsDeleted = false`;
      const accounts = await this.query<SalesforceAccount>(connection, soql);

      for (const account of accounts) {
        try {
          // Check if customer exists by external_id
          const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .eq('external_id', account.Id)
            .single();

          // Map Salesforce fields to CSCX fields
          const customerData: Record<string, unknown> = {
            external_id: account.Id,
            external_source: 'salesforce',
          };

          for (const mapping of fieldMappings) {
            if (mapping.direction === 'cscx_to_salesforce') continue;

            const value = account[mapping.salesforceField as keyof SalesforceAccount];
            if (value !== undefined) {
              customerData[mapping.cscxField] = value;
            }
          }

          if (existing) {
            // Update existing
            await supabase
              .from('customers')
              .update(customerData)
              .eq('id', existing.id);
            result.updated++;
          } else {
            // Create new
            await supabase.from('customers').insert(customerData);
            result.created++;
          }

          result.synced++;
        } catch (err) {
          result.errors.push(`Failed to sync ${account.Name}: ${(err as Error).message}`);
        }
      }

      // Log sync
      await this.logSync(userId, 'salesforce', 'accounts', result);

      return result;
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      return result;
    }
  }

  /**
   * Push health scores back to Salesforce
   */
  async pushHealthScores(connection: SalesforceConnection, userId: string): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    if (!supabase) {
      result.errors.push('Database not configured');
      return result;
    }

    try {
      // Get customers with external_id (Salesforce ID)
      const { data: customers } = await supabase
        .from('customers')
        .select('external_id, health_score, stage')
        .eq('external_source', 'salesforce')
        .not('external_id', 'is', null);

      if (!customers) return result;

      for (const customer of customers) {
        try {
          const success = await this.updateRecord(
            connection,
            'Account',
            customer.external_id,
            {
              Health_Score__c: customer.health_score,
              Stage__c: customer.stage,
            }
          );

          if (success) {
            result.synced++;
            result.updated++;
          } else {
            result.errors.push(`Failed to update ${customer.external_id}`);
          }
        } catch (err) {
          result.errors.push(`Error updating ${customer.external_id}: ${(err as Error).message}`);
        }
      }

      await this.logSync(userId, 'salesforce', 'health_scores', result);

      return result;
    } catch (error) {
      result.errors.push(`Push failed: ${(error as Error).message}`);
      return result;
    }
  }

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: SalesforceConnection,
    fieldMappings?: FieldMapping[]
  ): Promise<string> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .upsert({
        user_id: userId,
        provider: 'salesforce',
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken,
        instance_url: connection.instanceUrl,
        token_expires_at: connection.tokenExpiresAt.toISOString(),
        field_mappings: fieldMappings || DEFAULT_FIELD_MAPPINGS,
        sync_enabled: true,
      }, {
        onConflict: 'user_id,provider',
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save connection: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get saved connection for a user
   */
  async getConnection(userId: string): Promise<SalesforceConnection | null> {
    if (!supabase) {
      return null;
    }

    const { data } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'salesforce')
      .single();

    if (!data) return null;

    // Check if token needs refresh
    const expiresAt = new Date(data.token_expires_at);
    if (expiresAt <= new Date()) {
      // Refresh the token
      const refreshed = await this.refreshToken(data.refresh_token);
      await this.saveConnection(userId, refreshed, data.field_mappings);
      return refreshed;
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      instanceUrl: data.instance_url,
      tokenExpiresAt: expiresAt,
    };
  }

  /**
   * Log sync activity
   */
  private async logSync(
    userId: string,
    provider: string,
    syncType: string,
    result: SyncResult
  ): Promise<void> {
    if (!supabase) return;

    await supabase.from('sync_logs').insert({
      user_id: userId,
      provider,
      sync_type: syncType,
      records_synced: result.synced,
      records_created: result.created,
      records_updated: result.updated,
      errors: result.errors,
      completed_at: new Date().toISOString(),
    });
  }
}

export const salesforceService = new SalesforceService();
export default salesforceService;
