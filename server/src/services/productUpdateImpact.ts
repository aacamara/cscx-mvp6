/**
 * Product Update Impact Service
 * PRD-126: Product Update Impact Assessment
 *
 * Service for managing product updates, analyzing customer impact,
 * generating communication templates, and tracking adoption.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// ============================================
// Types (mirrored from frontend for server-side use)
// ============================================

export type UpdateType = 'feature' | 'improvement' | 'fix' | 'deprecation' | 'breaking';
export type ImpactType = 'positive' | 'neutral' | 'action_required' | 'at_risk';
export type AdoptionStatus = 'not_started' | 'in_progress' | 'completed';
export type MigrationStatus = 'not_started' | 'planning' | 'in_progress' | 'completed' | 'blocked';
export type DetectionSource = 'release_notes' | 'feature_flag' | 'deployment' | 'manual';

export interface ProductUpdate {
  id: string;
  name: string;
  version: string;
  updateType: UpdateType;
  description: string;
  releaseNotes: string;
  releasedAt: Date;
  effectiveDate: Date | null;
  deprecationDeadline: Date | null;
  affectedFeatures: string[];
  prerequisites: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerImpact {
  id: string;
  updateId: string;
  customerId: string;
  customerName: string;
  impactType: ImpactType;
  relevanceScore: number;
  reasons: ImpactReason[];
  recommendedAction: string;
  talkingPoints: string[];
  notifiedAt: Date | null;
  csmNotifiedAt: Date | null;
  adoptionStatus: AdoptionStatus;
  adoptionStartedAt: Date | null;
  adoptionCompletedAt: Date | null;
  feedback: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ImpactReason {
  factor: string;
  score: number;
  details: string;
}

export interface CommunicationTemplate {
  id: string;
  updateId: string;
  templateType: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: Array<{ name: string; description: string; defaultValue: string }>;
  targetImpactTypes: ImpactType[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AdoptionMetric {
  id: string;
  updateId: string;
  customerId: string;
  customerName: string;
  featureEnabled: boolean;
  featureEnabledAt: Date | null;
  usageCount: number;
  usageTrend: 'increasing' | 'stable' | 'decreasing' | 'not_started';
  lastUsedAt: Date | null;
  adoptionBlockers: Array<{
    type: string;
    description: string;
    reportedAt: Date;
    resolvedAt: Date | null;
  }>;
  feedbackReceived: boolean;
  feedbackSentiment: 'positive' | 'neutral' | 'negative' | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeprecationTracking {
  id: string;
  updateId: string;
  customerId: string;
  customerName: string;
  migrationStatus: MigrationStatus;
  migrationDeadline: Date;
  daysRemaining: number;
  migrationStartedAt: Date | null;
  migrationCompletedAt: Date | null;
  blockers: Array<{
    type: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    reportedAt: Date;
    resolvedAt: Date | null;
  }>;
  escalated: boolean;
  escalatedAt: Date | null;
  escalationReason: string | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Service Implementation
// ============================================

class ProductUpdateImpactService {
  private supabase: SupabaseClient | null = null;

  // In-memory storage for development/demo mode
  private updates: Map<string, ProductUpdate> = new Map();
  private customerImpacts: Map<string, CustomerImpact[]> = new Map();
  private templates: Map<string, CommunicationTemplate[]> = new Map();
  private adoptionMetrics: Map<string, AdoptionMetric[]> = new Map();
  private deprecationTracking: Map<string, DeprecationTracking[]> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }

    // Initialize with demo data
    this.initializeDemoData();
  }

  // ============================================
  // Product Update CRUD
  // ============================================

  async createProductUpdate(input: Omit<ProductUpdate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductUpdate> {
    const id = `update_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const update: ProductUpdate = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now
    };

    this.updates.set(id, update);

    // Automatically run impact assessment
    await this.runImpactAssessment(id);

    // Generate communication templates
    await this.generateCommunicationTemplates(id);

    console.log(`[ProductUpdateImpact] Created update: ${id} - ${input.name}`);
    return update;
  }

  async getProductUpdate(updateId: string): Promise<ProductUpdate | null> {
    return this.updates.get(updateId) || null;
  }

  async listProductUpdates(filters?: {
    updateType?: UpdateType;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ updates: ProductUpdate[]; total: number }> {
    let updates = Array.from(this.updates.values());

    // Apply filters
    if (filters?.updateType) {
      updates = updates.filter(u => u.updateType === filters.updateType);
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      updates = updates.filter(u =>
        u.name.toLowerCase().includes(search) ||
        u.description.toLowerCase().includes(search) ||
        u.version.toLowerCase().includes(search)
      );
    }

    // Sort by release date descending
    updates.sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime());

    const total = updates.length;

    // Apply pagination
    if (filters?.offset) {
      updates = updates.slice(filters.offset);
    }
    if (filters?.limit) {
      updates = updates.slice(0, filters.limit);
    }

    return { updates, total };
  }

  // ============================================
  // Impact Assessment
  // ============================================

  async runImpactAssessment(updateId: string): Promise<CustomerImpact[]> {
    const update = await this.getProductUpdate(updateId);
    if (!update) {
      throw new Error(`Update not found: ${updateId}`);
    }

    console.log(`[ProductUpdateImpact] Running impact assessment for: ${update.name}`);
    const startTime = Date.now();

    // Fetch all customers (in production, this would be from Supabase)
    const customers = this.getDemoCustomers();

    const impacts: CustomerImpact[] = [];

    for (const customer of customers) {
      const impact = this.analyzeCustomerImpact(update, customer);
      impacts.push(impact);
    }

    // Store impacts
    this.customerImpacts.set(updateId, impacts);

    const duration = Date.now() - startTime;
    console.log(`[ProductUpdateImpact] Assessment complete in ${duration}ms for ${impacts.length} customers`);

    return impacts;
  }

  private analyzeCustomerImpact(update: ProductUpdate, customer: any): CustomerImpact {
    const reasons: ImpactReason[] = [];
    let totalScore = 0;

    // Factor 1: Usage pattern (does customer use affected features?)
    const usageScore = this.calculateUsageRelevance(update, customer);
    if (usageScore > 0) {
      reasons.push({
        factor: 'usage_pattern',
        score: usageScore,
        details: `Customer actively uses ${update.affectedFeatures.length > 0 ? update.affectedFeatures[0] : 'related features'}`
      });
      totalScore += usageScore * 0.35;
    }

    // Factor 2: Entitlement eligibility
    const entitlementScore = this.calculateEntitlementRelevance(update, customer);
    if (entitlementScore > 0) {
      reasons.push({
        factor: 'entitlement',
        score: entitlementScore,
        details: customer.tier === 'enterprise' ? 'Enterprise tier with full feature access' : 'Standard feature access'
      });
      totalScore += entitlementScore * 0.20;
    }

    // Factor 3: Technical compatibility
    const techScore = this.calculateTechnicalCompatibility(update, customer);
    reasons.push({
      factor: 'technical_compat',
      score: techScore,
      details: techScore > 70 ? 'Fully compatible with customer tech stack' : 'May require technical adjustments'
    });
    totalScore += techScore * 0.15;

    // Factor 4: Workflow disruption (for breaking changes/deprecations)
    if (update.updateType === 'breaking' || update.updateType === 'deprecation') {
      const disruptionScore = this.calculateWorkflowDisruption(update, customer);
      reasons.push({
        factor: 'workflow_disruption',
        score: disruptionScore,
        details: disruptionScore > 50 ? 'Significant workflow changes required' : 'Minimal workflow impact'
      });
      totalScore += disruptionScore * 0.15;
    } else {
      totalScore += 30 * 0.15; // Low disruption for features/improvements
    }

    // Factor 5: Customer tier priority
    const tierScore = customer.tier === 'enterprise' ? 100 : customer.tier === 'mid-market' ? 70 : 40;
    reasons.push({
      factor: 'tier_priority',
      score: tierScore,
      details: `${customer.tier} tier customer`
    });
    totalScore += tierScore * 0.10;

    // Factor 6: Health score consideration
    const healthScore = customer.healthScore || 70;
    reasons.push({
      factor: 'health_score',
      score: healthScore,
      details: `Current health score: ${healthScore}`
    });
    totalScore += (100 - healthScore) * 0.05; // Higher priority for lower health

    // Determine impact type based on update type and relevance
    const impactType = this.determineImpactType(update, totalScore, customer);

    // Generate recommended action and talking points
    const { recommendedAction, talkingPoints } = this.generateRecommendations(update, impactType, customer);

    const now = new Date();
    return {
      id: `impact_${update.id}_${customer.id}`,
      updateId: update.id,
      customerId: customer.id,
      customerName: customer.name,
      impactType,
      relevanceScore: Math.round(totalScore),
      reasons,
      recommendedAction,
      talkingPoints,
      notifiedAt: null,
      csmNotifiedAt: null,
      adoptionStatus: 'not_started',
      adoptionStartedAt: null,
      adoptionCompletedAt: null,
      feedback: null,
      createdAt: now,
      updatedAt: now
    };
  }

  private calculateUsageRelevance(update: ProductUpdate, customer: any): number {
    // Simulate usage pattern analysis
    // In production, this would check actual usage data
    const baseScore = Math.random() * 60 + 40; // 40-100
    return Math.round(baseScore);
  }

  private calculateEntitlementRelevance(update: ProductUpdate, customer: any): number {
    // Check if customer has required entitlements
    if (customer.tier === 'enterprise') return 100;
    if (customer.tier === 'mid-market') return 75;
    return 50;
  }

  private calculateTechnicalCompatibility(update: ProductUpdate, customer: any): number {
    // Simulate technical compatibility check
    return Math.round(Math.random() * 30 + 70); // 70-100
  }

  private calculateWorkflowDisruption(update: ProductUpdate, customer: any): number {
    // Higher score = more disruption for breaking/deprecation changes
    if (update.updateType === 'breaking') {
      return Math.round(Math.random() * 50 + 50); // 50-100
    }
    if (update.updateType === 'deprecation') {
      return Math.round(Math.random() * 40 + 30); // 30-70
    }
    return Math.round(Math.random() * 30); // 0-30
  }

  private determineImpactType(update: ProductUpdate, relevanceScore: number, customer: any): ImpactType {
    // Breaking changes require action
    if (update.updateType === 'breaking') {
      return relevanceScore > 50 ? 'action_required' : 'neutral';
    }

    // Deprecations for high-relevance customers are at risk
    if (update.updateType === 'deprecation') {
      if (relevanceScore > 70) return 'at_risk';
      if (relevanceScore > 40) return 'action_required';
      return 'neutral';
    }

    // Features and improvements are positive for relevant customers
    if (update.updateType === 'feature' || update.updateType === 'improvement') {
      if (relevanceScore > 60) return 'positive';
      return 'neutral';
    }

    // Fixes
    return 'positive';
  }

  private generateRecommendations(
    update: ProductUpdate,
    impactType: ImpactType,
    customer: any
  ): { recommendedAction: string; talkingPoints: string[] } {
    const talkingPoints: string[] = [];
    let recommendedAction = '';

    switch (impactType) {
      case 'positive':
        recommendedAction = `Schedule feature enablement call for ${update.name}`;
        talkingPoints.push(
          `${update.name} is now available for ${customer.name}`,
          `Key benefits: ${update.description}`,
          `This aligns with their goal of improving ${update.affectedFeatures[0] || 'workflows'}`,
          'Offer training session to accelerate adoption'
        );
        break;

      case 'neutral':
        recommendedAction = `Include ${update.name} in next scheduled touchpoint`;
        talkingPoints.push(
          `${update.name} is available but may have limited relevance`,
          'Mention during next regular check-in',
          'Monitor for future interest or use cases'
        );
        break;

      case 'action_required':
        recommendedAction = `Proactively reach out about ${update.name} changes`;
        talkingPoints.push(
          `Important: ${update.name} requires customer attention`,
          `Action needed: ${update.updateType === 'breaking' ? 'Technical migration required' : 'Review and adapt workflows'}`,
          `Timeline: ${update.effectiveDate ? `By ${new Date(update.effectiveDate).toLocaleDateString()}` : 'At your earliest convenience'}`,
          'Offer dedicated support session'
        );
        break;

      case 'at_risk':
        recommendedAction = `URGENT: Engage ${customer.name} about ${update.name} immediately`;
        talkingPoints.push(
          `Critical: ${customer.name} may be at risk from ${update.name}`,
          `Risk: ${update.updateType === 'deprecation' ? 'Feature being deprecated' : 'Breaking change'}`,
          `Deadline: ${update.deprecationDeadline ? new Date(update.deprecationDeadline).toLocaleDateString() : 'ASAP'}`,
          'Escalate if no response within 48 hours'
        );
        break;
    }

    return { recommendedAction, talkingPoints };
  }

  // ============================================
  // Impact Retrieval
  // ============================================

  async getUpdateImpact(updateId: string): Promise<{
    update: ProductUpdate;
    impacts: CustomerImpact[];
    summary: {
      totalCustomers: number;
      byImpactType: Record<ImpactType, number>;
      totalARRImpacted: number;
      avgRelevanceScore: number;
    };
  } | null> {
    const update = await this.getProductUpdate(updateId);
    if (!update) return null;

    let impacts = this.customerImpacts.get(updateId) || [];

    // Run assessment if not yet done
    if (impacts.length === 0) {
      impacts = await this.runImpactAssessment(updateId);
    }

    // Calculate summary
    const customers = this.getDemoCustomers();
    const customerMap = new Map(customers.map(c => [c.id, c]));

    const byImpactType: Record<ImpactType, number> = {
      positive: 0,
      neutral: 0,
      action_required: 0,
      at_risk: 0
    };

    let totalARR = 0;
    let totalRelevance = 0;

    for (const impact of impacts) {
      byImpactType[impact.impactType]++;
      const customer = customerMap.get(impact.customerId);
      if (customer) {
        totalARR += customer.arr || 0;
      }
      totalRelevance += impact.relevanceScore;
    }

    return {
      update,
      impacts,
      summary: {
        totalCustomers: impacts.length,
        byImpactType,
        totalARRImpacted: totalARR,
        avgRelevanceScore: impacts.length > 0 ? Math.round(totalRelevance / impacts.length) : 0
      }
    };
  }

  async getCustomerUpdates(customerId: string): Promise<Array<{
    update: ProductUpdate;
    impact: CustomerImpact;
  }>> {
    const results: Array<{ update: ProductUpdate; impact: CustomerImpact }> = [];

    for (const [updateId, impacts] of this.customerImpacts.entries()) {
      const impact = impacts.find(i => i.customerId === customerId);
      if (impact) {
        const update = await this.getProductUpdate(updateId);
        if (update) {
          results.push({ update, impact });
        }
      }
    }

    // Sort by release date descending
    results.sort((a, b) =>
      new Date(b.update.releasedAt).getTime() - new Date(a.update.releasedAt).getTime()
    );

    return results;
  }

  // ============================================
  // Communication Templates
  // ============================================

  async generateCommunicationTemplates(updateId: string): Promise<CommunicationTemplate[]> {
    const update = await this.getProductUpdate(updateId);
    if (!update) {
      throw new Error(`Update not found: ${updateId}`);
    }

    const templates: CommunicationTemplate[] = [];
    const now = new Date();

    // Announcement template
    templates.push({
      id: `template_${updateId}_announcement`,
      updateId,
      templateType: 'announcement',
      name: `${update.name} Announcement`,
      subject: `New ${update.updateType === 'feature' ? 'Feature' : 'Update'}: ${update.name}`,
      bodyHtml: this.generateAnnouncementHtml(update),
      bodyText: this.generateAnnouncementText(update),
      variables: [
        { name: 'customerName', description: 'Customer company name', defaultValue: '{{customerName}}' },
        { name: 'contactName', description: 'Primary contact name', defaultValue: '{{contactName}}' },
        { name: 'csmName', description: 'CSM name', defaultValue: '{{csmName}}' }
      ],
      targetImpactTypes: ['positive', 'neutral'],
      createdAt: now,
      updatedAt: now
    });

    // FAQ template for action_required/at_risk
    if (update.updateType === 'breaking' || update.updateType === 'deprecation') {
      templates.push({
        id: `template_${updateId}_faq`,
        updateId,
        templateType: 'faq',
        name: `${update.name} FAQ`,
        subject: `FAQ: ${update.name} - What You Need to Know`,
        bodyHtml: this.generateFAQHtml(update),
        bodyText: this.generateFAQText(update),
        variables: [
          { name: 'customerName', description: 'Customer company name', defaultValue: '{{customerName}}' },
          { name: 'deadline', description: 'Action deadline', defaultValue: update.deprecationDeadline?.toString() || 'TBD' }
        ],
        targetImpactTypes: ['action_required', 'at_risk'],
        createdAt: now,
        updatedAt: now
      });

      // Migration guide for deprecations
      if (update.updateType === 'deprecation') {
        templates.push({
          id: `template_${updateId}_migration`,
          updateId,
          templateType: 'migration_guide',
          name: `${update.name} Migration Guide`,
          subject: `Migration Guide: Transitioning from ${update.name}`,
          bodyHtml: this.generateMigrationGuideHtml(update),
          bodyText: this.generateMigrationGuideText(update),
          variables: [
            { name: 'customerName', description: 'Customer company name', defaultValue: '{{customerName}}' },
            { name: 'migrationDeadline', description: 'Migration deadline', defaultValue: update.deprecationDeadline?.toString() || 'TBD' }
          ],
          targetImpactTypes: ['action_required', 'at_risk'],
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // Training invitation for features
    if (update.updateType === 'feature' || update.updateType === 'improvement') {
      templates.push({
        id: `template_${updateId}_training`,
        updateId,
        templateType: 'training_invitation',
        name: `${update.name} Training Invitation`,
        subject: `Training Available: Get the Most from ${update.name}`,
        bodyHtml: this.generateTrainingHtml(update),
        bodyText: this.generateTrainingText(update),
        variables: [
          { name: 'customerName', description: 'Customer company name', defaultValue: '{{customerName}}' },
          { name: 'trainingDate', description: 'Training session date', defaultValue: 'TBD' }
        ],
        targetImpactTypes: ['positive'],
        createdAt: now,
        updatedAt: now
      });
    }

    this.templates.set(updateId, templates);
    return templates;
  }

  private generateAnnouncementHtml(update: ProductUpdate): string {
    return `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>Introducing ${update.name}</h2>
  <p>Hi {{contactName}},</p>
  <p>I'm excited to share that we've just released <strong>${update.name}</strong> (v${update.version})!</p>

  <h3>What's New</h3>
  <p>${update.description}</p>

  <h3>Key Benefits</h3>
  <ul>
    ${update.releaseNotes.split('\n').map(note => `<li>${note}</li>`).join('')}
  </ul>

  <p>I'd love to schedule a quick call to show you how {{customerName}} can benefit from this update.</p>

  <p>Best regards,<br/>{{csmName}}</p>
</body>
</html>`;
  }

  private generateAnnouncementText(update: ProductUpdate): string {
    return `
Introducing ${update.name}

Hi {{contactName}},

I'm excited to share that we've just released ${update.name} (v${update.version})!

What's New:
${update.description}

Key Benefits:
${update.releaseNotes}

I'd love to schedule a quick call to show you how {{customerName}} can benefit from this update.

Best regards,
{{csmName}}
`;
  }

  private generateFAQHtml(update: ProductUpdate): string {
    return `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>FAQ: ${update.name}</h2>

  <h3>What is changing?</h3>
  <p>${update.description}</p>

  <h3>When does this take effect?</h3>
  <p>This change will take effect on {{deadline}}.</p>

  <h3>What do I need to do?</h3>
  <p>${update.updateType === 'breaking' ? 'You will need to update your integration before the deadline.' : 'Please review the changes and adapt your workflows as needed.'}</p>

  <h3>Who can I contact for help?</h3>
  <p>Your Customer Success Manager {{csmName}} is available to assist you through this transition.</p>
</body>
</html>`;
  }

  private generateFAQText(update: ProductUpdate): string {
    return `FAQ: ${update.name}

What is changing?
${update.description}

When does this take effect?
This change will take effect on {{deadline}}.

What do I need to do?
${update.updateType === 'breaking' ? 'You will need to update your integration before the deadline.' : 'Please review the changes and adapt your workflows as needed.'}

Who can I contact for help?
Your Customer Success Manager {{csmName}} is available to assist you through this transition.`;
  }

  private generateMigrationGuideHtml(update: ProductUpdate): string {
    return `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>Migration Guide: ${update.name}</h2>
  <p>Hi {{contactName}},</p>

  <p>As discussed, ${update.name} is being deprecated. This guide will help {{customerName}} smoothly transition.</p>

  <h3>Migration Timeline</h3>
  <ul>
    <li><strong>Deadline:</strong> {{migrationDeadline}}</li>
    <li><strong>Status:</strong> Planning phase</li>
  </ul>

  <h3>Steps to Migrate</h3>
  <ol>
    <li>Review current usage of the deprecated feature</li>
    <li>Identify replacement functionality</li>
    <li>Plan migration timeline with your team</li>
    <li>Execute migration in staging environment</li>
    <li>Roll out to production</li>
  </ol>

  <p>We're here to help. Let's schedule a migration planning session.</p>

  <p>Best regards,<br/>{{csmName}}</p>
</body>
</html>`;
  }

  private generateMigrationGuideText(update: ProductUpdate): string {
    return `Migration Guide: ${update.name}

Hi {{contactName}},

As discussed, ${update.name} is being deprecated. This guide will help {{customerName}} smoothly transition.

Migration Timeline:
- Deadline: {{migrationDeadline}}
- Status: Planning phase

Steps to Migrate:
1. Review current usage of the deprecated feature
2. Identify replacement functionality
3. Plan migration timeline with your team
4. Execute migration in staging environment
5. Roll out to production

We're here to help. Let's schedule a migration planning session.

Best regards,
{{csmName}}`;
  }

  private generateTrainingHtml(update: ProductUpdate): string {
    return `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>Training: ${update.name}</h2>
  <p>Hi {{contactName}},</p>

  <p>We're offering exclusive training sessions on ${update.name} to help {{customerName}} get the most value.</p>

  <h3>What You'll Learn</h3>
  <ul>
    <li>How to enable and configure ${update.name}</li>
    <li>Best practices for implementation</li>
    <li>Tips and tricks from our product team</li>
    <li>Q&A with our experts</li>
  </ul>

  <h3>Training Details</h3>
  <p><strong>Date:</strong> {{trainingDate}}<br/>
  <strong>Duration:</strong> 45 minutes<br/>
  <strong>Format:</strong> Live webinar with recording available</p>

  <p>Would you like me to reserve a spot for your team?</p>

  <p>Best regards,<br/>{{csmName}}</p>
</body>
</html>`;
  }

  private generateTrainingText(update: ProductUpdate): string {
    return `Training: ${update.name}

Hi {{contactName}},

We're offering exclusive training sessions on ${update.name} to help {{customerName}} get the most value.

What You'll Learn:
- How to enable and configure ${update.name}
- Best practices for implementation
- Tips and tricks from our product team
- Q&A with our experts

Training Details:
Date: {{trainingDate}}
Duration: 45 minutes
Format: Live webinar with recording available

Would you like me to reserve a spot for your team?

Best regards,
{{csmName}}`;
  }

  async getTemplatesForUpdate(updateId: string): Promise<CommunicationTemplate[]> {
    let templates = this.templates.get(updateId);
    if (!templates) {
      templates = await this.generateCommunicationTemplates(updateId);
    }
    return templates;
  }

  // ============================================
  // CSM Notification
  // ============================================

  async notifyCSMs(updateId: string, csmIds?: string[]): Promise<{
    notified: number;
    notifications: Array<{
      csmId: string;
      csmName: string;
      customerCount: number;
      notifiedAt: Date;
    }>;
  }> {
    const update = await this.getProductUpdate(updateId);
    if (!update) {
      throw new Error(`Update not found: ${updateId}`);
    }

    const impacts = this.customerImpacts.get(updateId) || [];
    if (impacts.length === 0) {
      throw new Error('No impact assessment found. Run assessment first.');
    }

    // Group impacts by CSM
    const csmImpacts = new Map<string, CustomerImpact[]>();
    const customers = this.getDemoCustomers();
    const customerMap = new Map(customers.map(c => [c.id, c]));

    for (const impact of impacts) {
      const customer = customerMap.get(impact.customerId);
      if (!customer) continue;

      const csmId = customer.csmId || 'unassigned';
      if (csmIds && csmIds.length > 0 && !csmIds.includes(csmId)) continue;

      if (!csmImpacts.has(csmId)) {
        csmImpacts.set(csmId, []);
      }
      csmImpacts.get(csmId)!.push(impact);
    }

    const notifications: Array<{
      csmId: string;
      csmName: string;
      customerCount: number;
      notifiedAt: Date;
    }> = [];

    const now = new Date();

    for (const [csmId, csmCustomerImpacts] of csmImpacts.entries()) {
      // Mark impacts as notified
      for (const impact of csmCustomerImpacts) {
        impact.csmNotifiedAt = now;
        impact.updatedAt = now;
      }

      notifications.push({
        csmId,
        csmName: this.getDemoCsmName(csmId),
        customerCount: csmCustomerImpacts.length,
        notifiedAt: now
      });

      console.log(`[ProductUpdateImpact] Notified CSM ${csmId} about ${csmCustomerImpacts.length} impacted customers`);
    }

    return {
      notified: notifications.length,
      notifications
    };
  }

  // ============================================
  // Adoption Tracking
  // ============================================

  async getAdoptionMetrics(updateId: string): Promise<{
    summary: {
      totalCustomers: number;
      adoptionRate: number;
      byStatus: Record<AdoptionStatus, number>;
      avgDaysToAdoption: number | null;
      topBlockers: Array<{ type: string; count: number }>;
    };
    metrics: AdoptionMetric[];
  }> {
    const impacts = this.customerImpacts.get(updateId) || [];

    // Generate adoption metrics from impacts
    const metrics: AdoptionMetric[] = impacts.map(impact => {
      const now = new Date();
      const adoptionMetric: AdoptionMetric = {
        id: `adoption_${impact.id}`,
        updateId: impact.updateId,
        customerId: impact.customerId,
        customerName: impact.customerName,
        featureEnabled: impact.adoptionStatus === 'completed',
        featureEnabledAt: impact.adoptionCompletedAt,
        usageCount: impact.adoptionStatus === 'completed' ? Math.floor(Math.random() * 100) + 10 : 0,
        usageTrend: impact.adoptionStatus === 'completed'
          ? (['increasing', 'stable', 'decreasing'] as const)[Math.floor(Math.random() * 3)]
          : 'not_started',
        lastUsedAt: impact.adoptionStatus === 'completed' ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null,
        adoptionBlockers: impact.adoptionStatus === 'in_progress' && Math.random() > 0.5
          ? [{
              type: ['technical_issue', 'training_needed', 'resource_constraint'][Math.floor(Math.random() * 3)],
              description: 'Pending internal review',
              reportedAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
              resolvedAt: null
            }]
          : [],
        feedbackReceived: impact.feedback !== null,
        feedbackSentiment: impact.feedback ? (['positive', 'neutral', 'negative'] as const)[Math.floor(Math.random() * 3)] : null,
        createdAt: impact.createdAt,
        updatedAt: now
      };
      return adoptionMetric;
    });

    // Calculate summary
    const byStatus: Record<AdoptionStatus, number> = {
      not_started: 0,
      in_progress: 0,
      completed: 0
    };

    const blockerCounts = new Map<string, number>();

    for (const metric of metrics) {
      const impact = impacts.find(i => i.customerId === metric.customerId);
      if (impact) {
        byStatus[impact.adoptionStatus]++;
      }

      for (const blocker of metric.adoptionBlockers) {
        blockerCounts.set(blocker.type, (blockerCounts.get(blocker.type) || 0) + 1);
      }
    }

    const topBlockers = Array.from(blockerCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const adoptionRate = metrics.length > 0
      ? Math.round((byStatus.completed / metrics.length) * 100)
      : 0;

    return {
      summary: {
        totalCustomers: metrics.length,
        adoptionRate,
        byStatus,
        avgDaysToAdoption: byStatus.completed > 0 ? Math.round(Math.random() * 14) + 7 : null,
        topBlockers
      },
      metrics
    };
  }

  async updateAdoptionStatus(
    updateId: string,
    customerId: string,
    status: AdoptionStatus
  ): Promise<CustomerImpact | null> {
    const impacts = this.customerImpacts.get(updateId);
    if (!impacts) return null;

    const impact = impacts.find(i => i.customerId === customerId);
    if (!impact) return null;

    const now = new Date();
    impact.adoptionStatus = status;
    impact.updatedAt = now;

    if (status === 'in_progress' && !impact.adoptionStartedAt) {
      impact.adoptionStartedAt = now;
    }
    if (status === 'completed') {
      impact.adoptionCompletedAt = now;
    }

    return impact;
  }

  // ============================================
  // Deprecation Management
  // ============================================

  async getDeprecationStatus(updateId: string): Promise<{
    summary: {
      deprecationDeadline: Date | null;
      totalAffectedCustomers: number;
      byStatus: Record<MigrationStatus, number>;
      atRiskCount: number;
      completedCount: number;
      arrAtRisk: number;
    };
    tracking: DeprecationTracking[];
  } | null> {
    const update = await this.getProductUpdate(updateId);
    if (!update || (update.updateType !== 'deprecation' && update.updateType !== 'breaking')) {
      return null;
    }

    const impacts = this.customerImpacts.get(updateId) || [];
    const customers = this.getDemoCustomers();
    const customerMap = new Map(customers.map(c => [c.id, c]));

    const tracking: DeprecationTracking[] = [];
    const byStatus: Record<MigrationStatus, number> = {
      not_started: 0,
      planning: 0,
      in_progress: 0,
      completed: 0,
      blocked: 0
    };
    let arrAtRisk = 0;

    for (const impact of impacts) {
      if (impact.impactType !== 'action_required' && impact.impactType !== 'at_risk') {
        continue;
      }

      const customer = customerMap.get(impact.customerId);
      const deadline = update.deprecationDeadline || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      // Simulate migration status
      const statuses: MigrationStatus[] = ['not_started', 'planning', 'in_progress', 'completed'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const riskLevel = status === 'not_started' && daysRemaining < 30
        ? 'critical'
        : status === 'not_started' && daysRemaining < 60
          ? 'high'
          : status === 'planning' && daysRemaining < 30
            ? 'medium'
            : 'low';

      byStatus[status]++;

      if (riskLevel === 'high' || riskLevel === 'critical') {
        arrAtRisk += customer?.arr || 0;
      }

      tracking.push({
        id: `deprecation_${impact.id}`,
        updateId,
        customerId: impact.customerId,
        customerName: impact.customerName,
        migrationStatus: status,
        migrationDeadline: deadline,
        daysRemaining,
        migrationStartedAt: status !== 'not_started' ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null,
        migrationCompletedAt: status === 'completed' ? new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000) : null,
        blockers: status === 'blocked' ? [{
          type: 'technical_dependency',
          description: 'Waiting for vendor support',
          impact: 'high',
          reportedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          resolvedAt: null
        }] : [],
        escalated: riskLevel === 'critical',
        escalatedAt: riskLevel === 'critical' ? new Date() : null,
        escalationReason: riskLevel === 'critical' ? 'Customer at risk of missing deadline' : null,
        riskLevel,
        createdAt: impact.createdAt,
        updatedAt: new Date()
      });
    }

    return {
      summary: {
        deprecationDeadline: update.deprecationDeadline,
        totalAffectedCustomers: tracking.length,
        byStatus,
        atRiskCount: tracking.filter(t => t.riskLevel === 'high' || t.riskLevel === 'critical').length,
        completedCount: byStatus.completed,
        arrAtRisk
      },
      tracking
    };
  }

  // ============================================
  // Demo Data Helpers
  // ============================================

  private getDemoCustomers(): any[] {
    return [
      { id: '1', name: 'Acme Corporation', arr: 120000, tier: 'enterprise', healthScore: 85, csmId: 'csm_1' },
      { id: '2', name: 'TechStart Inc', arr: 65000, tier: 'mid-market', healthScore: 48, csmId: 'csm_1' },
      { id: '3', name: 'GlobalTech Solutions', arr: 280000, tier: 'enterprise', healthScore: 92, csmId: 'csm_2' },
      { id: '4', name: 'DataFlow Inc', arr: 95000, tier: 'mid-market', healthScore: 35, csmId: 'csm_1' },
      { id: '5', name: 'CloudNine Systems', arr: 150000, tier: 'enterprise', healthScore: 78, csmId: 'csm_2' },
      { id: '6', name: 'MegaCorp Industries', arr: 340000, tier: 'enterprise', healthScore: 72, csmId: 'csm_2' },
      { id: '7', name: 'StartupX', arr: 45000, tier: 'smb', healthScore: 61, csmId: 'csm_3' },
      { id: '8', name: 'Enterprise Plus', arr: 520000, tier: 'enterprise', healthScore: 88, csmId: 'csm_2' },
      { id: '9', name: 'SmallBiz Co', arr: 28000, tier: 'smb', healthScore: 55, csmId: 'csm_3' },
      { id: '10', name: 'Innovation Labs', arr: 175000, tier: 'mid-market', healthScore: 82, csmId: 'csm_1' }
    ];
  }

  private getDemoCsmName(csmId: string): string {
    const csmNames: Record<string, string> = {
      'csm_1': 'Sarah Johnson',
      'csm_2': 'Michael Chen',
      'csm_3': 'Emily Rodriguez',
      'unassigned': 'Unassigned'
    };
    return csmNames[csmId] || 'Unknown';
  }

  private initializeDemoData(): void {
    const now = new Date();

    // Demo updates
    const demoUpdates: Omit<ProductUpdate, 'createdAt' | 'updatedAt'>[] = [
      {
        id: 'update_1',
        name: 'Advanced Analytics Dashboard',
        version: '2.5.0',
        updateType: 'feature',
        description: 'New analytics dashboard with customizable widgets, real-time data visualization, and export capabilities.',
        releaseNotes: 'Customizable widgets\nReal-time data sync\nCSV and PDF export\nDark mode support',
        releasedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        effectiveDate: null,
        deprecationDeadline: null,
        affectedFeatures: ['analytics', 'reporting', 'dashboards'],
        prerequisites: ['basic_analytics']
      },
      {
        id: 'update_2',
        name: 'Legacy API v1 Deprecation',
        version: '3.0.0',
        updateType: 'deprecation',
        description: 'API v1 endpoints are being deprecated in favor of v2. All customers must migrate by the deadline.',
        releaseNotes: 'v1 endpoints deprecated\nv2 endpoints now default\nMigration guide available\n90-day transition period',
        releasedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        effectiveDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        deprecationDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        affectedFeatures: ['api', 'integrations'],
        prerequisites: []
      },
      {
        id: 'update_3',
        name: 'Performance Improvements',
        version: '2.4.5',
        updateType: 'improvement',
        description: 'Significant performance improvements across the platform with faster page loads and reduced API latency.',
        releaseNotes: '40% faster page loads\n50% reduced API latency\nOptimized database queries\nImproved caching',
        releasedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        effectiveDate: null,
        deprecationDeadline: null,
        affectedFeatures: ['platform', 'api', 'ui'],
        prerequisites: []
      },
      {
        id: 'update_4',
        name: 'Authentication Flow Breaking Change',
        version: '3.1.0',
        updateType: 'breaking',
        description: 'Updated authentication flow with enhanced security. Requires SDK update for all integrations.',
        releaseNotes: 'New OAuth 2.1 flow\nRefresh token rotation\nNew SDK required\nBackward incompatible',
        releasedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        effectiveDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        deprecationDeadline: null,
        affectedFeatures: ['authentication', 'api', 'security'],
        prerequisites: []
      }
    ];

    for (const updateData of demoUpdates) {
      const update: ProductUpdate = {
        ...updateData,
        createdAt: now,
        updatedAt: now
      };
      this.updates.set(update.id, update);
    }

    console.log(`[ProductUpdateImpact] Initialized with ${demoUpdates.length} demo updates`);
  }
}

// Export singleton instance
export const productUpdateImpactService = new ProductUpdateImpactService();
