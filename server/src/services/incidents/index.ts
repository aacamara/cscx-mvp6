/**
 * Incident Service
 * PRD-097: Product Issue Alert
 *
 * Handles product incident management, customer impact analysis,
 * and communication workflows.
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { slackService } from '../slack/index.js';

// ============================================
// Types
// ============================================

export type IncidentSeverity = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type OutreachStatus = 'pending' | 'draft_ready' | 'sent' | 'acknowledged' | 'followed_up';

export interface ProductIncident {
  id: string;
  externalId?: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedComponents: string[];
  affectedRegions: string[];
  startedAt: Date;
  identifiedAt?: Date;
  monitoringAt?: Date;
  resolvedAt?: Date;
  statusPageUrl?: string;
  incidentCommander?: string;
  rootCause?: string;
  resolutionSummary?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerImpact {
  id: string;
  incidentId: string;
  customerId: string;
  customerName?: string;
  customerArr?: number;
  customerHealthScore?: number;
  impactLevel: ImpactLevel;
  reason?: string;
  affectedFeatures: string[];
  estimatedRevenueImpact?: number;
  csmId?: string;
  csmNotifiedAt?: Date;
  customerNotifiedAt?: Date;
  outreachStatus: OutreachStatus;
  outreachMethod?: string;
  outreachNotes?: string;
  resolutionNotifiedAt?: Date;
  followUpScheduledAt?: Date;
  customerSentiment?: string;
  customerFeedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidentStatusUpdate {
  id: string;
  incidentId: string;
  previousStatus?: IncidentStatus;
  newStatus: IncidentStatus;
  message: string;
  internalNotes?: string;
  updatedBy?: string;
  createdAt: Date;
}

export interface IncidentWithImpact extends ProductIncident {
  affectedCustomers: CustomerImpact[];
  totalArrAtRisk: number;
  affectedCustomerCount: number;
  criticalImpactCount: number;
  highImpactCount: number;
  customersNotified: number;
  customersPending: number;
}

export interface CreateIncidentInput {
  externalId?: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  affectedComponents: string[];
  affectedRegions?: string[];
  startedAt?: Date;
  statusPageUrl?: string;
  incidentCommander?: string;
}

export interface UpdateIncidentInput {
  status?: IncidentStatus;
  description?: string;
  affectedComponents?: string[];
  affectedRegions?: string[];
  statusPageUrl?: string;
  incidentCommander?: string;
  rootCause?: string;
  resolutionSummary?: string;
  metadata?: Record<string, any>;
}

export interface IncidentSummary {
  incident: ProductIncident;
  affectedCustomers: Array<{
    customer: {
      id: string;
      name: string;
      arr: number;
      healthScore: number;
    };
    impactLevel: ImpactLevel;
    reason: string;
    outreachStatus: OutreachStatus;
  }>;
  totalArrAtRisk: number;
}

// ============================================
// Incident Service
// ============================================

export class IncidentService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Incident CRUD Operations
  // ============================================

  async createIncident(input: CreateIncidentInput): Promise<ProductIncident> {
    const incident: ProductIncident = {
      id: uuidv4(),
      externalId: input.externalId,
      title: input.title,
      description: input.description,
      severity: input.severity,
      status: 'investigating',
      affectedComponents: input.affectedComponents,
      affectedRegions: input.affectedRegions || [],
      startedAt: input.startedAt || new Date(),
      statusPageUrl: input.statusPageUrl,
      incidentCommander: input.incidentCommander,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.supabase) {
      const { error } = await this.supabase
        .from('product_incidents')
        .insert({
          id: incident.id,
          external_id: incident.externalId,
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
          status: incident.status,
          affected_components: incident.affectedComponents,
          affected_regions: incident.affectedRegions,
          started_at: incident.startedAt.toISOString(),
          status_page_url: incident.statusPageUrl,
          incident_commander: incident.incidentCommander,
        });

      if (error) {
        console.error('[IncidentService] Create error:', error);
        throw new Error(`Failed to create incident: ${error.message}`);
      }
    }

    // Analyze customer impact
    await this.analyzeCustomerImpact(incident);

    return incident;
  }

  async getIncident(id: string): Promise<ProductIncident | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('product_incidents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return this.mapDbIncident(data);
  }

  async getIncidentByExternalId(externalId: string): Promise<ProductIncident | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('product_incidents')
      .select('*')
      .eq('external_id', externalId)
      .single();

    if (error || !data) return null;

    return this.mapDbIncident(data);
  }

  async updateIncident(
    id: string,
    input: UpdateIncidentInput,
    updateMessage?: string,
    updatedBy?: string
  ): Promise<ProductIncident | null> {
    if (!this.supabase) return null;

    // Get current incident
    const current = await this.getIncident(id);
    if (!current) return null;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.status) {
      updates.status = input.status;

      // Set timestamp based on status change
      if (input.status === 'identified' && !current.identifiedAt) {
        updates.identified_at = new Date().toISOString();
      } else if (input.status === 'monitoring' && !current.monitoringAt) {
        updates.monitoring_at = new Date().toISOString();
      } else if (input.status === 'resolved' && !current.resolvedAt) {
        updates.resolved_at = new Date().toISOString();
      }
    }

    if (input.description !== undefined) updates.description = input.description;
    if (input.affectedComponents) updates.affected_components = input.affectedComponents;
    if (input.affectedRegions) updates.affected_regions = input.affectedRegions;
    if (input.statusPageUrl !== undefined) updates.status_page_url = input.statusPageUrl;
    if (input.incidentCommander !== undefined) updates.incident_commander = input.incidentCommander;
    if (input.rootCause !== undefined) updates.root_cause = input.rootCause;
    if (input.resolutionSummary !== undefined) updates.resolution_summary = input.resolutionSummary;
    if (input.metadata) updates.metadata = input.metadata;

    const { error } = await this.supabase
      .from('product_incidents')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[IncidentService] Update error:', error);
      throw new Error(`Failed to update incident: ${error.message}`);
    }

    // Log status update
    if (input.status && updateMessage) {
      await this.addStatusUpdate(id, current.status, input.status, updateMessage, updatedBy);
    }

    return this.getIncident(id);
  }

  async listActiveIncidents(): Promise<ProductIncident[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('product_incidents')
      .select('*')
      .neq('status', 'resolved')
      .order('started_at', { ascending: false });

    if (error || !data) return [];

    return data.map(this.mapDbIncident);
  }

  async listIncidents(options: {
    status?: IncidentStatus;
    severity?: IncidentSeverity;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ incidents: ProductIncident[]; total: number }> {
    if (!this.supabase) return { incidents: [], total: 0 };

    let query = this.supabase
      .from('product_incidents')
      .select('*', { count: 'exact' });

    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.severity) {
      query = query.eq('severity', options.severity);
    }

    query = query.order('started_at', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) return { incidents: [], total: 0 };

    return {
      incidents: (data || []).map(this.mapDbIncident),
      total: count || 0,
    };
  }

  // ============================================
  // Customer Impact Analysis
  // ============================================

  async analyzeCustomerImpact(incident: ProductIncident): Promise<CustomerImpact[]> {
    if (!this.supabase) return [];

    const affectedCustomers: CustomerImpact[] = [];

    // Find customers affected by components
    if (incident.affectedComponents.length > 0) {
      const { data: componentMappings } = await this.supabase
        .from('component_customer_mapping')
        .select('customer_id, usage_level, is_integration_dependent, component_name')
        .in('component_name', incident.affectedComponents);

      if (componentMappings) {
        for (const mapping of componentMappings) {
          const impactLevel = this.determineImpactLevel(
            mapping.usage_level,
            mapping.is_integration_dependent,
            incident.severity
          );

          affectedCustomers.push({
            id: uuidv4(),
            incidentId: incident.id,
            customerId: mapping.customer_id,
            impactLevel,
            reason: `Uses ${mapping.component_name} (${mapping.usage_level} usage)${
              mapping.is_integration_dependent ? ', integration-dependent' : ''
            }`,
            affectedFeatures: [mapping.component_name],
            outreachStatus: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    // Find customers affected by regions
    if (incident.affectedRegions.length > 0) {
      const { data: regionMappings } = await this.supabase
        .from('region_customer_mapping')
        .select('customer_id, region_name, is_primary_region')
        .in('region_name', incident.affectedRegions);

      if (regionMappings) {
        for (const mapping of regionMappings) {
          // Check if already added from component mapping
          const existing = affectedCustomers.find(
            (c) => c.customerId === mapping.customer_id
          );

          if (existing) {
            // Increase impact if primary region
            if (mapping.is_primary_region && existing.impactLevel !== 'critical') {
              existing.impactLevel = this.upgradeImpactLevel(existing.impactLevel);
            }
            existing.reason += ` | In affected region: ${mapping.region_name}`;
          } else {
            const impactLevel = mapping.is_primary_region ? 'high' : 'medium';
            affectedCustomers.push({
              id: uuidv4(),
              incidentId: incident.id,
              customerId: mapping.customer_id,
              impactLevel,
              reason: `Located in affected region: ${mapping.region_name}${
                mapping.is_primary_region ? ' (primary region)' : ''
              }`,
              affectedFeatures: [],
              outreachStatus: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }
    }

    // Get customer details and enrich impact data
    if (affectedCustomers.length > 0) {
      const customerIds = affectedCustomers.map((c) => c.customerId);
      const { data: customers } = await this.supabase
        .from('customers')
        .select('id, name, arr, health_score, csm_id')
        .in('id', customerIds);

      if (customers) {
        for (const customer of customers) {
          const impact = affectedCustomers.find((c) => c.customerId === customer.id);
          if (impact) {
            impact.customerName = customer.name;
            impact.customerArr = customer.arr;
            impact.customerHealthScore = customer.health_score;
            impact.csmId = customer.csm_id;

            // Upgrade impact for high-value customers
            if (customer.arr > 500000 && impact.impactLevel !== 'critical') {
              impact.impactLevel = this.upgradeImpactLevel(impact.impactLevel);
              impact.reason += ' | High-value customer';
            }
          }
        }
      }

      // Save impact records
      await this.saveCustomerImpacts(affectedCustomers);
    }

    return affectedCustomers;
  }

  private determineImpactLevel(
    usageLevel: string,
    isIntegrationDependent: boolean,
    severity: IncidentSeverity
  ): ImpactLevel {
    if (severity === 'P1') {
      if (usageLevel === 'critical' || isIntegrationDependent) return 'critical';
      if (usageLevel === 'heavy') return 'high';
      return 'medium';
    }
    if (severity === 'P2') {
      if (usageLevel === 'critical') return 'high';
      if (usageLevel === 'heavy' || isIntegrationDependent) return 'medium';
      return 'low';
    }
    if (usageLevel === 'critical' || usageLevel === 'heavy') return 'medium';
    return 'low';
  }

  private upgradeImpactLevel(current: ImpactLevel): ImpactLevel {
    switch (current) {
      case 'low':
        return 'medium';
      case 'medium':
        return 'high';
      case 'high':
        return 'critical';
      default:
        return current;
    }
  }

  private async saveCustomerImpacts(impacts: CustomerImpact[]): Promise<void> {
    if (!this.supabase || impacts.length === 0) return;

    const records = impacts.map((impact) => ({
      id: impact.id,
      incident_id: impact.incidentId,
      customer_id: impact.customerId,
      impact_level: impact.impactLevel,
      reason: impact.reason,
      affected_features: impact.affectedFeatures,
      csm_id: impact.csmId,
      outreach_status: impact.outreachStatus,
    }));

    const { error } = await this.supabase
      .from('incident_customer_impact')
      .upsert(records, { onConflict: 'incident_id,customer_id' });

    if (error) {
      console.error('[IncidentService] Save impacts error:', error);
    }
  }

  async getIncidentWithImpact(id: string): Promise<IncidentWithImpact | null> {
    const incident = await this.getIncident(id);
    if (!incident) return null;

    const impacts = await this.getCustomerImpacts(id);

    return {
      ...incident,
      affectedCustomers: impacts,
      totalArrAtRisk: impacts.reduce((sum, i) => sum + (i.customerArr || 0), 0),
      affectedCustomerCount: impacts.length,
      criticalImpactCount: impacts.filter((i) => i.impactLevel === 'critical').length,
      highImpactCount: impacts.filter((i) => i.impactLevel === 'high').length,
      customersNotified: impacts.filter((i) => i.outreachStatus === 'sent').length,
      customersPending: impacts.filter((i) => i.outreachStatus === 'pending').length,
    };
  }

  async getCustomerImpacts(incidentId: string): Promise<CustomerImpact[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('incident_customer_impact')
      .select(`
        *,
        customers(id, name, arr, health_score)
      `)
      .eq('incident_id', incidentId)
      .order('impact_level', { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      incidentId: row.incident_id,
      customerId: row.customer_id,
      customerName: row.customers?.name,
      customerArr: row.customers?.arr,
      customerHealthScore: row.customers?.health_score,
      impactLevel: row.impact_level,
      reason: row.reason,
      affectedFeatures: row.affected_features || [],
      estimatedRevenueImpact: row.estimated_revenue_impact,
      csmId: row.csm_id,
      csmNotifiedAt: row.csm_notified_at ? new Date(row.csm_notified_at) : undefined,
      customerNotifiedAt: row.customer_notified_at ? new Date(row.customer_notified_at) : undefined,
      outreachStatus: row.outreach_status,
      outreachMethod: row.outreach_method,
      outreachNotes: row.outreach_notes,
      resolutionNotifiedAt: row.resolution_notified_at ? new Date(row.resolution_notified_at) : undefined,
      followUpScheduledAt: row.follow_up_scheduled_at ? new Date(row.follow_up_scheduled_at) : undefined,
      customerSentiment: row.customer_sentiment,
      customerFeedback: row.customer_feedback,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async updateCustomerImpact(
    incidentId: string,
    customerId: string,
    updates: Partial<CustomerImpact>
  ): Promise<void> {
    if (!this.supabase) return;

    const dbUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.outreachStatus) dbUpdates.outreach_status = updates.outreachStatus;
    if (updates.outreachMethod) dbUpdates.outreach_method = updates.outreachMethod;
    if (updates.outreachNotes !== undefined) dbUpdates.outreach_notes = updates.outreachNotes;
    if (updates.customerNotifiedAt) dbUpdates.customer_notified_at = updates.customerNotifiedAt.toISOString();
    if (updates.resolutionNotifiedAt) dbUpdates.resolution_notified_at = updates.resolutionNotifiedAt.toISOString();
    if (updates.followUpScheduledAt) dbUpdates.follow_up_scheduled_at = updates.followUpScheduledAt.toISOString();
    if (updates.customerSentiment) dbUpdates.customer_sentiment = updates.customerSentiment;
    if (updates.customerFeedback !== undefined) dbUpdates.customer_feedback = updates.customerFeedback;

    await this.supabase
      .from('incident_customer_impact')
      .update(dbUpdates)
      .eq('incident_id', incidentId)
      .eq('customer_id', customerId);
  }

  // ============================================
  // Status Updates
  // ============================================

  async addStatusUpdate(
    incidentId: string,
    previousStatus: IncidentStatus | undefined,
    newStatus: IncidentStatus,
    message: string,
    updatedBy?: string,
    internalNotes?: string
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('incident_status_updates').insert({
      id: uuidv4(),
      incident_id: incidentId,
      previous_status: previousStatus,
      new_status: newStatus,
      message,
      internal_notes: internalNotes,
      updated_by: updatedBy,
    });
  }

  async getStatusUpdates(incidentId: string): Promise<IncidentStatusUpdate[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('incident_status_updates')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      incidentId: row.incident_id,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      message: row.message,
      internalNotes: row.internal_notes,
      updatedBy: row.updated_by,
      createdAt: new Date(row.created_at),
    }));
  }

  // ============================================
  // Notifications
  // ============================================

  async notifyCSMs(incident: ProductIncident, userId: string): Promise<void> {
    try {
      const impacts = await this.getCustomerImpacts(incident.id);
      if (impacts.length === 0) return;

      // Group by CSM
      const csmImpacts = new Map<string, CustomerImpact[]>();
      for (const impact of impacts) {
        if (impact.csmId) {
          const existing = csmImpacts.get(impact.csmId) || [];
          existing.push(impact);
          csmImpacts.set(impact.csmId, existing);
        }
      }

      // Build Slack message blocks
      const blocks = this.buildIncidentAlertBlocks(incident, impacts);

      // Send to a designated channel (for now, we'll log it)
      // In production, you'd look up CSM Slack user IDs and DM them
      console.log('[IncidentService] Would notify CSMs:', {
        incident: incident.title,
        affectedCsmCount: csmImpacts.size,
        totalCustomers: impacts.length,
      });

      // Mark CSMs as notified
      await this.markCsmsNotified(incident.id);

      // Send to Slack if connected
      try {
        const isConnected = await slackService.isConnected(userId);
        if (isConnected) {
          // Get channels and try to find an incident channel
          const channels = await slackService.listChannels(userId, {
            types: ['public_channel', 'private_channel'],
            excludeArchived: true,
          });

          const incidentChannel = channels.find(
            (c) => c.name.includes('incident') || c.name.includes('customer-success')
          );

          if (incidentChannel) {
            await slackService.sendMessage(userId, {
              channel: incidentChannel.id,
              text: `P${incident.severity.slice(1)} Incident: ${incident.title}`,
              blocks,
            });
          }
        }
      } catch (slackError) {
        console.error('[IncidentService] Slack notification error:', slackError);
      }
    } catch (error) {
      console.error('[IncidentService] Notify CSMs error:', error);
    }
  }

  private buildIncidentAlertBlocks(incident: ProductIncident, impacts: CustomerImpact[]): any[] {
    const severityEmoji = incident.severity === 'P1' ? ':rotating_light:' : ':warning:';
    const totalArr = impacts.reduce((sum, i) => sum + (i.customerArr || 0), 0);

    const criticalCustomers = impacts.filter((i) => i.impactLevel === 'critical');
    const highCustomers = impacts.filter((i) => i.impactLevel === 'high');
    const mediumCustomers = impacts.filter((i) => i.impactLevel === 'medium');
    const lowCustomers = impacts.filter((i) => i.impactLevel === 'low');

    const customerList = [
      ...criticalCustomers.map((c) => `:rotating_light: *${c.customerName}* - $${((c.customerArr || 0) / 1000).toFixed(0)}K ARR - Critical impact`),
      ...highCustomers.map((c) => `:rotating_light: ${c.customerName} - $${((c.customerArr || 0) / 1000).toFixed(0)}K ARR - High impact`),
      ...mediumCustomers.slice(0, 3).map((c) => `:warning: ${c.customerName} - $${((c.customerArr || 0) / 1000).toFixed(0)}K ARR`),
    ];

    if (mediumCustomers.length > 3) {
      customerList.push(`...and ${mediumCustomers.length - 3 + lowCustomers.length} more`);
    }

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji} ${incident.severity} INCIDENT: ${incident.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Incident ID:*\n${incident.externalId || incident.id.slice(0, 8)}` },
          { type: 'mrkdwn', text: `*Status:*\n${incident.status}` },
          { type: 'mrkdwn', text: `*Started:*\n${incident.startedAt.toLocaleString()}` },
          { type: 'mrkdwn', text: `*Affected Components:*\n${incident.affectedComponents.join(', ')}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Your Affected Customers (${impacts.length}):*\n${customerList.join('\n')}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Total ARR at Risk:* $${(totalArr / 1000).toFixed(0)}K`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: incident.statusPageUrl
              ? `<${incident.statusPageUrl}|View Status Page>`
              : 'Status page not available',
          },
        ],
      },
    ];
  }

  private async markCsmsNotified(incidentId: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('incident_customer_impact')
      .update({ csm_notified_at: new Date().toISOString() })
      .eq('incident_id', incidentId)
      .is('csm_notified_at', null);
  }

  async notifyResolution(incident: ProductIncident, userId: string): Promise<void> {
    try {
      const impacts = await this.getCustomerImpacts(incident.id);
      if (impacts.length === 0) return;

      const duration = incident.resolvedAt
        ? this.formatDuration(incident.resolvedAt.getTime() - incident.startedAt.getTime())
        : 'Unknown';

      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `:white_check_mark: INCIDENT RESOLVED: ${incident.title}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Incident ID:*\n${incident.externalId || incident.id.slice(0, 8)}` },
            { type: 'mrkdwn', text: `*Duration:*\n${duration}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Resolution:*\n${incident.resolutionSummary || 'No summary provided'}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Affected Customers:* ${impacts.length}\n\n*Next Steps:*\n1. Send resolution notification to affected customers\n2. Schedule follow-up calls for high-impact customers\n3. Prepare post-mortem summary`,
          },
        },
      ];

      // Try to send to Slack
      try {
        const isConnected = await slackService.isConnected(userId);
        if (isConnected) {
          const channels = await slackService.listChannels(userId);
          const incidentChannel = channels.find(
            (c) => c.name.includes('incident') || c.name.includes('customer-success')
          );

          if (incidentChannel) {
            await slackService.sendMessage(userId, {
              channel: incidentChannel.id,
              text: `Incident Resolved: ${incident.title}`,
              blocks,
            });
          }
        }
      } catch (slackError) {
        console.error('[IncidentService] Slack resolution notification error:', slackError);
      }

      console.log('[IncidentService] Resolution notification sent for:', incident.title);
    } catch (error) {
      console.error('[IncidentService] Notify resolution error:', error);
    }
  }

  // ============================================
  // Message Templates
  // ============================================

  async getMessageTemplate(
    type: string,
    severity?: IncidentSeverity,
    channel?: string
  ): Promise<{ subject?: string; body: string } | null> {
    if (!this.supabase) return null;

    let query = this.supabase
      .from('incident_message_templates')
      .select('*')
      .eq('type', type)
      .eq('is_active', true);

    if (channel) {
      query = query.eq('channel', channel);
    }

    // Try severity-specific first
    if (severity) {
      const { data: specific } = await query.eq('severity', severity).single();
      if (specific) {
        return { subject: specific.subject_template, body: specific.body_template };
      }
    }

    // Fall back to generic
    const { data: generic } = await query.is('severity', null).single();
    if (generic) {
      return { subject: generic.subject_template, body: generic.body_template };
    }

    return null;
  }

  // ============================================
  // Helpers
  // ============================================

  private mapDbIncident(row: any): ProductIncident {
    return {
      id: row.id,
      externalId: row.external_id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      affectedComponents: row.affected_components || [],
      affectedRegions: row.affected_regions || [],
      startedAt: new Date(row.started_at),
      identifiedAt: row.identified_at ? new Date(row.identified_at) : undefined,
      monitoringAt: row.monitoring_at ? new Date(row.monitoring_at) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      statusPageUrl: row.status_page_url,
      incidentCommander: row.incident_commander,
      rootCause: row.root_cause,
      resolutionSummary: row.resolution_summary,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

// Singleton instance
export const incidentService = new IncidentService();
