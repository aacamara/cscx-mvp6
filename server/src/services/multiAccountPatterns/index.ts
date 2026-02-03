/**
 * Multi-Account Pattern Service (PRD-105)
 *
 * Monitors customers with multiple accounts (subsidiaries, divisions, regions)
 * to detect patterns across related entities:
 * - Risk contagion: Issues spreading across accounts
 * - Replication opportunity: Successful playbooks to replicate
 * - Synchronized changes: Coordinated health/usage changes
 * - Cross-expansion: Expansion spreading from one entity to another
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { ClaudeService } from '../claude.js';
import {
  CustomerFamily,
  CustomerFamilyMember,
  CustomerRelationshipType,
  MultiAccountPattern,
  PatternType,
  PatternSeverity,
  PatternStatus,
  PatternDetails,
  RiskContagionDetails,
  ReplicationOpportunityDetails,
  SynchronizedChangeDetails,
  CrossExpansionDetails,
  PatternDetectionConfig,
  DEFAULT_DETECTION_CONFIG,
  FamilyDashboardResponse,
  PatternAlertPayload,
  DetectPatternsOptions,
  GetPatternsOptions,
} from './types.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Multi-Account Pattern Service
// ============================================

class MultiAccountPatternService {
  private claude: ClaudeService;

  constructor() {
    this.claude = new ClaudeService();
  }

  // ============================================
  // Family Management
  // ============================================

  /**
   * Get all customer families (parent accounts with children)
   */
  async getCustomerFamilies(): Promise<CustomerFamily[]> {
    if (!supabase) {
      return this.getMockFamilies();
    }

    // Get all parent customers (those with children)
    const { data: parents, error } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        arr,
        health_score,
        children:customers!parent_customer_id(
          id,
          name,
          relationship_type,
          arr,
          health_score,
          stage,
          csm_name,
          updated_at
        )
      `)
      .is('parent_customer_id', null)
      .not('id', 'in', supabase.from('customers').select('parent_customer_id').not('parent_customer_id', 'is', null));

    if (error) {
      console.error('[MultiAccountPatterns] Error fetching families:', error);
      return [];
    }

    // Filter to only parents that have children
    const families = (parents || [])
      .filter((p: any) => p.children && p.children.length > 0)
      .map((parent: any) => this.buildCustomerFamily(parent));

    return families;
  }

  /**
   * Get a specific customer family by parent ID
   */
  async getCustomerFamily(parentCustomerId: string): Promise<CustomerFamily | null> {
    if (!supabase) {
      const families = await this.getMockFamilies();
      return families.find(f => f.parentCustomerId === parentCustomerId) || null;
    }

    const { data: parent, error } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        arr,
        health_score,
        children:customers!parent_customer_id(
          id,
          name,
          relationship_type,
          arr,
          health_score,
          stage,
          csm_name,
          updated_at
        )
      `)
      .eq('id', parentCustomerId)
      .single();

    if (error || !parent) {
      return null;
    }

    return this.buildCustomerFamily(parent);
  }

  /**
   * Set parent-child relationship between customers
   */
  async setParentRelationship(
    childCustomerId: string,
    parentCustomerId: string,
    relationshipType: CustomerRelationshipType
  ): Promise<boolean> {
    if (!supabase) {
      return true; // Mock success
    }

    const { error } = await supabase
      .from('customers')
      .update({
        parent_customer_id: parentCustomerId,
        relationship_type: relationshipType,
      })
      .eq('id', childCustomerId);

    if (error) {
      console.error('[MultiAccountPatterns] Error setting parent relationship:', error);
      return false;
    }

    return true;
  }

  /**
   * Remove parent-child relationship
   */
  async removeParentRelationship(childCustomerId: string): Promise<boolean> {
    if (!supabase) {
      return true;
    }

    const { error } = await supabase
      .from('customers')
      .update({
        parent_customer_id: null,
        relationship_type: null,
      })
      .eq('id', childCustomerId);

    return !error;
  }

  // ============================================
  // Pattern Detection
  // ============================================

  /**
   * Run pattern detection for all families or a specific family
   */
  async detectPatterns(options: DetectPatternsOptions = {}): Promise<MultiAccountPattern[]> {
    const { parentCustomerId, patternTypes, config: customConfig } = options;
    const detectionConfig = { ...DEFAULT_DETECTION_CONFIG, ...customConfig };
    const detectedPatterns: MultiAccountPattern[] = [];

    // Get families to analyze
    let families: CustomerFamily[];
    if (parentCustomerId) {
      const family = await this.getCustomerFamily(parentCustomerId);
      families = family ? [family] : [];
    } else {
      families = await this.getCustomerFamilies();
    }

    // Detect patterns for each family
    for (const family of families) {
      const typesToDetect = patternTypes || ['risk_contagion', 'replication_opportunity', 'synchronized_change', 'cross_expansion'];

      // Run detection in parallel
      const detectionPromises = typesToDetect.map(async (type) => {
        switch (type) {
          case 'risk_contagion':
            return this.detectRiskContagion(family, detectionConfig);
          case 'replication_opportunity':
            return this.detectReplicationOpportunity(family, detectionConfig);
          case 'synchronized_change':
            return this.detectSynchronizedChange(family, detectionConfig);
          case 'cross_expansion':
            return this.detectCrossExpansion(family, detectionConfig);
          default:
            return [];
        }
      });

      const results = await Promise.all(detectionPromises);
      detectedPatterns.push(...results.flat());
    }

    // Save detected patterns
    for (const pattern of detectedPatterns) {
      await this.savePattern(pattern);
    }

    return detectedPatterns;
  }

  /**
   * Detect risk contagion patterns
   */
  private async detectRiskContagion(
    family: CustomerFamily,
    config: PatternDetectionConfig
  ): Promise<MultiAccountPattern[]> {
    const patterns: MultiAccountPattern[] = [];
    const { healthDropThreshold, minSimilarityScore } = config.riskContagion;

    // Find accounts with significant health drops
    const atRiskAccounts = family.children.filter(
      child => child.healthTrend === 'down' || child.healthScore < 60
    );

    if (atRiskAccounts.length === 0) {
      return [];
    }

    // For each at-risk account, assess contagion risk to others
    for (const sourceAccount of atRiskAccounts) {
      const affectedAccounts = family.children
        .filter(child => child.customerId !== sourceAccount.customerId)
        .map(child => ({
          customerId: child.customerId,
          name: child.name,
          currentHealth: child.healthScore,
          riskExposure: this.calculateRiskExposure(sourceAccount, child),
          sharedFactors: this.findSharedFactors(sourceAccount, child),
        }))
        .filter(account => account.riskExposure !== 'low');

      if (affectedAccounts.length > 0) {
        const severity = this.calculateRiskSeverity(sourceAccount, affectedAccounts);
        const spreadRisk = this.calculateSpreadRisk(sourceAccount, affectedAccounts);

        const details: RiskContagionDetails = {
          sourceCustomerId: sourceAccount.customerId,
          sourceCustomerName: sourceAccount.name,
          riskType: this.identifyRiskType(sourceAccount),
          riskSeverity: severity,
          spreadRisk,
          affectedAccounts,
          rootCause: sourceAccount.riskSignals[0],
          timeline: `Detected over last ${config.riskContagion.lookbackDays} days`,
        };

        const pattern: MultiAccountPattern = {
          id: uuidv4(),
          parentCustomerId: family.parentCustomerId,
          parentCustomerName: family.parentName,
          patternType: 'risk_contagion',
          affectedCustomers: [sourceAccount.customerId, ...affectedAccounts.map(a => a.customerId)],
          details: { type: 'risk_contagion', data: details },
          severity,
          confidenceScore: Math.round(spreadRisk),
          recommendation: this.generateRiskRecommendation(sourceAccount, affectedAccounts),
          status: 'active',
          detectedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Detect replication opportunity patterns
   */
  private async detectReplicationOpportunity(
    family: CustomerFamily,
    config: PatternDetectionConfig
  ): Promise<MultiAccountPattern[]> {
    const patterns: MultiAccountPattern[] = [];
    const { minHealthImprovement, minConfidenceScore } = config.replicationOpportunity;

    // Find high-performing accounts with recent improvements
    const successfulAccounts = family.children.filter(
      child => child.healthScore >= 80 && child.healthTrend === 'up'
    );

    if (successfulAccounts.length === 0) {
      return [];
    }

    // Find candidate accounts that could benefit
    const candidateAccounts = family.children.filter(
      child => child.healthScore < 75 || child.healthTrend !== 'up'
    );

    if (candidateAccounts.length === 0) {
      return [];
    }

    for (const successful of successfulAccounts) {
      // Simulate fetching playbook execution data
      const playbook = await this.getRecentSuccessfulPlaybook(successful.customerId);

      if (!playbook) continue;

      const candidates = candidateAccounts.map(candidate => ({
        customerId: candidate.customerId,
        name: candidate.name,
        currentHealth: candidate.healthScore,
        fitScore: this.calculatePlaybookFit(successful, candidate, playbook),
        missingElements: this.identifyMissingElements(candidate, playbook),
        potentialGain: Math.round((successful.healthScore - candidate.healthScore) * 0.7),
      })).filter(c => c.fitScore >= minConfidenceScore);

      if (candidates.length > 0) {
        const details: ReplicationOpportunityDetails = {
          successfulCustomerId: successful.customerId,
          successfulCustomerName: successful.name,
          playbook: {
            id: playbook.id,
            name: playbook.name,
            completedAt: playbook.completedAt,
          },
          improvements: {
            healthScoreDelta: playbook.healthDelta,
            usageDelta: playbook.usageDelta,
            adoptionDelta: playbook.adoptionDelta,
            specificMetrics: playbook.metrics,
          },
          candidateAccounts: candidates,
          successStory: `${successful.name} improved health score by ${playbook.healthDelta} points through ${playbook.name}`,
        };

        const pattern: MultiAccountPattern = {
          id: uuidv4(),
          parentCustomerId: family.parentCustomerId,
          parentCustomerName: family.parentName,
          patternType: 'replication_opportunity',
          affectedCustomers: [successful.customerId, ...candidates.map(c => c.customerId)],
          details: { type: 'replication_opportunity', data: details },
          severity: 'medium',
          confidenceScore: Math.round(candidates.reduce((sum, c) => sum + c.fitScore, 0) / candidates.length),
          recommendation: `Replicate ${playbook.name} from ${successful.name} to ${candidates.map(c => c.name).join(', ')}`,
          status: 'active',
          detectedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Detect synchronized change patterns
   */
  private async detectSynchronizedChange(
    family: CustomerFamily,
    config: PatternDetectionConfig
  ): Promise<MultiAccountPattern[]> {
    const patterns: MultiAccountPattern[] = [];
    const { minAffectedAccounts, changeMagnitudeThreshold } = config.synchronizedChange;

    // Group accounts by trend direction
    const improving = family.children.filter(c => c.healthTrend === 'up');
    const declining = family.children.filter(c => c.healthTrend === 'down');

    // Check for synchronized improvement
    if (improving.length >= minAffectedAccounts) {
      const details: SynchronizedChangeDetails = {
        changeType: 'health_improvement',
        changeMagnitude: 15, // Would be calculated from actual data
        accountsInvolved: improving.map(c => ({
          customerId: c.customerId,
          name: c.name,
          changeValue: 10, // Would come from actual health history
          changePercent: 15,
        })),
        correlationStrength: 80,
        possibleCause: 'Coordinated success initiative',
        timeframe: {
          start: new Date(Date.now() - config.synchronizedChange.windowDays * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
      };

      patterns.push({
        id: uuidv4(),
        parentCustomerId: family.parentCustomerId,
        parentCustomerName: family.parentName,
        patternType: 'synchronized_change',
        affectedCustomers: improving.map(c => c.customerId),
        details: { type: 'synchronized_change', data: details },
        severity: 'low',
        confidenceScore: 80,
        recommendation: 'Document and amplify the coordinated success pattern',
        status: 'active',
        detectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Check for synchronized decline
    if (declining.length >= minAffectedAccounts) {
      const details: SynchronizedChangeDetails = {
        changeType: 'health_decline',
        changeMagnitude: -15,
        accountsInvolved: declining.map(c => ({
          customerId: c.customerId,
          name: c.name,
          changeValue: -10,
          changePercent: -15,
        })),
        correlationStrength: 85,
        possibleCause: 'Shared operational challenge or external factor',
        timeframe: {
          start: new Date(Date.now() - config.synchronizedChange.windowDays * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
      };

      patterns.push({
        id: uuidv4(),
        parentCustomerId: family.parentCustomerId,
        parentCustomerName: family.parentName,
        patternType: 'synchronized_change',
        affectedCustomers: declining.map(c => c.customerId),
        details: { type: 'synchronized_change', data: details },
        severity: 'high',
        confidenceScore: 85,
        recommendation: 'Investigate root cause affecting multiple accounts and escalate to parent company contact',
        status: 'active',
        detectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return patterns;
  }

  /**
   * Detect cross-expansion patterns
   */
  private async detectCrossExpansion(
    family: CustomerFamily,
    config: PatternDetectionConfig
  ): Promise<MultiAccountPattern[]> {
    const patterns: MultiAccountPattern[] = [];

    // Find accounts with recent expansions
    const expandedAccounts = family.children.filter(
      c => c.healthScore >= 75 // High-health as proxy for recent expansion
    );

    if (expandedAccounts.length === 0) {
      return [];
    }

    // Find accounts that could expand similarly
    const expansionCandidates = family.children.filter(
      c => c.healthScore >= 60 && c.healthScore < 85
    );

    if (expansionCandidates.length === 0) {
      return [];
    }

    // Create cross-expansion opportunity
    const sourceAccount = expandedAccounts[0];
    const details: CrossExpansionDetails = {
      sourceCustomerId: sourceAccount.customerId,
      sourceCustomerName: sourceAccount.name,
      expansionType: 'feature',
      expansionDetails: {
        feature: 'Advanced Analytics',
        value: 25000,
      },
      similarAccounts: expansionCandidates.map(c => ({
        customerId: c.customerId,
        name: c.name,
        currentUsage: { logins: 150, apiCalls: 5000 },
        expansionPotential: Math.round(70 + Math.random() * 20),
        readinessIndicators: ['High usage', 'Engaged stakeholders', 'Recent training completion'],
      })),
    };

    patterns.push({
      id: uuidv4(),
      parentCustomerId: family.parentCustomerId,
      parentCustomerName: family.parentName,
      patternType: 'cross_expansion',
      affectedCustomers: [sourceAccount.customerId, ...expansionCandidates.map(c => c.customerId)],
      details: { type: 'cross_expansion', data: details },
      severity: 'low',
      confidenceScore: 75,
      recommendation: `Leverage ${sourceAccount.name}'s expansion success to pitch similar expansion to ${expansionCandidates.map(c => c.name).join(', ')}`,
      status: 'active',
      detectedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return patterns;
  }

  // ============================================
  // Pattern Management
  // ============================================

  /**
   * Get patterns with filtering
   */
  async getPatterns(options: GetPatternsOptions = {}): Promise<MultiAccountPattern[]> {
    if (!supabase) {
      return this.getMockPatterns(options);
    }

    let query = supabase
      .from('multi_account_patterns')
      .select('*');

    if (options.parentCustomerId) {
      query = query.eq('parent_customer_id', options.parentCustomerId);
    }
    if (options.patternTypes && options.patternTypes.length > 0) {
      query = query.in('pattern_type', options.patternTypes);
    }
    if (options.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }
    if (options.severity && options.severity.length > 0) {
      query = query.in('severity', options.severity);
    }

    const sortColumn = options.sortBy || 'detected_at';
    const sortOrder = options.sortOrder === 'asc' ? { ascending: true } : { ascending: false };
    query = query.order(sortColumn, sortOrder);

    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[MultiAccountPatterns] Error fetching patterns:', error);
      return [];
    }

    return (data || []).map(this.mapPatternFromDb);
  }

  /**
   * Get a specific pattern by ID
   */
  async getPattern(patternId: string): Promise<MultiAccountPattern | null> {
    if (!supabase) {
      const patterns = await this.getMockPatterns({});
      return patterns.find(p => p.id === patternId) || null;
    }

    const { data, error } = await supabase
      .from('multi_account_patterns')
      .select('*')
      .eq('id', patternId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapPatternFromDb(data);
  }

  /**
   * Update pattern status
   */
  async updatePatternStatus(
    patternId: string,
    status: PatternStatus,
    userId?: string
  ): Promise<boolean> {
    if (!supabase) {
      return true;
    }

    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'acknowledged' && userId) {
      updates.acknowledged_by = userId;
      updates.acknowledged_at = new Date().toISOString();
    }

    if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('multi_account_patterns')
      .update(updates)
      .eq('id', patternId);

    return !error;
  }

  /**
   * Save a new pattern
   */
  private async savePattern(pattern: MultiAccountPattern): Promise<void> {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from('multi_account_patterns').insert({
      id: pattern.id,
      parent_customer_id: pattern.parentCustomerId,
      pattern_type: pattern.patternType,
      affected_customers: pattern.affectedCustomers,
      details: pattern.details,
      severity: pattern.severity,
      confidence_score: pattern.confidenceScore,
      recommendation: pattern.recommendation,
      status: pattern.status,
      detected_at: pattern.detectedAt,
      created_at: pattern.createdAt,
      updated_at: pattern.updatedAt,
    });

    if (error) {
      console.error('[MultiAccountPatterns] Error saving pattern:', error);
    }
  }

  // ============================================
  // Family Dashboard
  // ============================================

  /**
   * Get comprehensive family dashboard
   */
  async getFamilyDashboard(parentCustomerId: string): Promise<FamilyDashboardResponse | null> {
    const family = await this.getCustomerFamily(parentCustomerId);
    if (!family) {
      return null;
    }

    const patterns = await this.getPatterns({
      parentCustomerId,
      status: ['active'],
      sortBy: 'severity',
      sortOrder: 'desc',
    });

    const healthHistory = await this.getFamilyHealthHistory(parentCustomerId);

    const recommendations = await this.generateFamilyRecommendations(family, patterns);

    return {
      family,
      patterns,
      healthHistory,
      recommendations,
    };
  }

  /**
   * Get family health history
   */
  private async getFamilyHealthHistory(
    parentCustomerId: string
  ): Promise<Array<{ date: string; aggregatedScore: number; childScores: Record<string, number> }>> {
    if (!supabase) {
      // Generate mock history
      const history = [];
      for (let i = 30; i >= 0; i -= 7) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        history.push({
          date: date.toISOString().split('T')[0],
          aggregatedScore: 70 + Math.floor(Math.random() * 15),
          childScores: {
            'child-1': 65 + Math.floor(Math.random() * 20),
            'child-2': 70 + Math.floor(Math.random() * 15),
            'child-3': 60 + Math.floor(Math.random() * 25),
          },
        });
      }
      return history;
    }

    const { data, error } = await supabase
      .from('family_health_history')
      .select('*')
      .eq('parent_customer_id', parentCustomerId)
      .order('calculated_at', { ascending: true })
      .limit(90);

    if (error || !data) {
      return [];
    }

    return data.map(row => ({
      date: row.calculated_at.split('T')[0],
      aggregatedScore: row.aggregated_health_score,
      childScores: row.child_scores,
    }));
  }

  /**
   * Generate AI-powered recommendations for the family
   */
  private async generateFamilyRecommendations(
    family: CustomerFamily,
    patterns: MultiAccountPattern[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Add pattern-based recommendations
    for (const pattern of patterns.slice(0, 3)) {
      recommendations.push(pattern.recommendation);
    }

    // Add health-based recommendations
    const atRiskChildren = family.children.filter(c => c.healthScore < 60);
    if (atRiskChildren.length > 0) {
      recommendations.push(
        `${atRiskChildren.length} accounts require immediate attention: ${atRiskChildren.map(c => c.name).join(', ')}`
      );
    }

    // Add cross-pollination recommendation
    const healthyChildren = family.children.filter(c => c.healthScore >= 80);
    if (healthyChildren.length > 0 && atRiskChildren.length > 0) {
      recommendations.push(
        `Consider transferring best practices from ${healthyChildren[0].name} to struggling accounts`
      );
    }

    return recommendations;
  }

  // ============================================
  // Alert Payload Generation
  // ============================================

  /**
   * Generate alert payload for Slack notification
   */
  generateAlertPayload(pattern: MultiAccountPattern, family: CustomerFamily): PatternAlertPayload {
    const affectedAccounts = pattern.affectedCustomers.map(customerId => {
      const child = family.children.find(c => c.customerId === customerId);
      return {
        name: child?.name || 'Unknown',
        healthScore: child?.healthScore || 0,
        arrAtRisk: child?.arr,
      };
    });

    const headline = this.generateAlertHeadline(pattern);
    const actions = this.generateAlertActions(pattern);

    return {
      patternId: pattern.id,
      patternType: pattern.patternType,
      parentCustomerName: pattern.parentCustomerName || family.parentName,
      severity: pattern.severity,
      headline,
      details: pattern.details,
      recommendation: pattern.recommendation,
      affectedAccounts,
      actions,
    };
  }

  private generateAlertHeadline(pattern: MultiAccountPattern): string {
    switch (pattern.patternType) {
      case 'risk_contagion': {
        const details = pattern.details.data as RiskContagionDetails;
        return `Risk detected at ${details.sourceCustomerName} may spread to ${details.affectedAccounts.length} related accounts`;
      }
      case 'replication_opportunity': {
        const details = pattern.details.data as ReplicationOpportunityDetails;
        return `Success pattern at ${details.successfulCustomerName} can be replicated to ${details.candidateAccounts.length} accounts`;
      }
      case 'synchronized_change': {
        const details = pattern.details.data as SynchronizedChangeDetails;
        return `${details.accountsInvolved.length} accounts showing synchronized ${details.changeType.replace('_', ' ')}`;
      }
      case 'cross_expansion': {
        const details = pattern.details.data as CrossExpansionDetails;
        return `Expansion opportunity: ${details.similarAccounts.length} accounts ready for ${details.expansionType} expansion`;
      }
      default:
        return 'Multi-account pattern detected';
    }
  }

  private generateAlertActions(pattern: MultiAccountPattern): Array<{ label: string; action: string; url?: string }> {
    const actions = [
      { label: 'View Parent Dashboard', action: 'view_dashboard', url: `/customers/${pattern.parentCustomerId}/family` },
      { label: 'Acknowledge', action: `acknowledge_pattern_${pattern.id}` },
    ];

    switch (pattern.patternType) {
      case 'risk_contagion':
        actions.push({ label: 'Create Save Play', action: `create_save_play_${pattern.id}` });
        break;
      case 'replication_opportunity':
        actions.push({ label: 'Draft Cross-Region Email', action: `draft_replication_email_${pattern.id}` });
        actions.push({ label: 'Create Playbook', action: `create_playbook_${pattern.id}` });
        break;
      case 'synchronized_change':
        actions.push({ label: 'Schedule Family Meeting', action: `schedule_family_meeting_${pattern.id}` });
        break;
      case 'cross_expansion':
        actions.push({ label: 'Create Expansion Plan', action: `create_expansion_plan_${pattern.id}` });
        break;
    }

    return actions;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private buildCustomerFamily(parent: any): CustomerFamily {
    const children: CustomerFamilyMember[] = (parent.children || []).map((child: any) => ({
      customerId: child.id,
      name: child.name,
      relationshipType: child.relationship_type || 'subsidiary',
      arr: child.arr || 0,
      healthScore: child.health_score || 0,
      healthTrend: this.inferHealthTrend(child.health_score),
      stage: child.stage || 'active',
      csmName: child.csm_name,
      lastContactDays: this.calculateDaysSinceUpdate(child.updated_at),
      riskSignals: this.inferRiskSignals(child),
    }));

    const totalArr = children.reduce((sum, c) => sum + c.arr, 0);
    const aggregatedHealth = children.length > 0
      ? Math.round(children.reduce((sum, c) => sum + c.healthScore, 0) / children.length)
      : 0;

    return {
      parentCustomerId: parent.id,
      parentName: parent.name,
      totalArr,
      aggregatedHealthScore: aggregatedHealth,
      children,
      healthTrend: this.inferFamilyTrend(children),
    };
  }

  private inferHealthTrend(healthScore: number): 'up' | 'down' | 'stable' {
    // Simplified - would use actual health history
    if (healthScore >= 75) return 'up';
    if (healthScore < 50) return 'down';
    return 'stable';
  }

  private inferFamilyTrend(children: CustomerFamilyMember[]): 'improving' | 'stable' | 'declining' {
    const upCount = children.filter(c => c.healthTrend === 'up').length;
    const downCount = children.filter(c => c.healthTrend === 'down').length;

    if (upCount > downCount) return 'improving';
    if (downCount > upCount) return 'declining';
    return 'stable';
  }

  private calculateDaysSinceUpdate(updatedAt: string | null): number {
    if (!updatedAt) return 30;
    return Math.floor((Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000));
  }

  private inferRiskSignals(child: any): string[] {
    const signals: string[] = [];
    if ((child.health_score || 0) < 50) signals.push('Low health score');
    if (child.stage === 'at_risk') signals.push('At-risk status');
    return signals;
  }

  private calculateRiskExposure(
    source: CustomerFamilyMember,
    target: CustomerFamilyMember
  ): 'high' | 'medium' | 'low' {
    // Simplified logic - would use more sophisticated similarity analysis
    if (source.relationshipType === target.relationshipType) return 'high';
    if (target.healthScore < 60) return 'medium';
    return 'low';
  }

  private findSharedFactors(
    source: CustomerFamilyMember,
    target: CustomerFamilyMember
  ): string[] {
    const factors: string[] = [];
    if (source.relationshipType === target.relationshipType) {
      factors.push('Same relationship type');
    }
    if (source.csmName === target.csmName) {
      factors.push('Same CSM');
    }
    return factors;
  }

  private calculateRiskSeverity(
    source: CustomerFamilyMember,
    affected: Array<{ riskExposure: string }>
  ): PatternSeverity {
    const highRiskCount = affected.filter(a => a.riskExposure === 'high').length;
    if (highRiskCount >= 2 || source.healthScore < 40) return 'critical';
    if (highRiskCount >= 1 || source.healthScore < 50) return 'high';
    if (source.healthScore < 60) return 'medium';
    return 'low';
  }

  private calculateSpreadRisk(
    source: CustomerFamilyMember,
    affected: Array<{ riskExposure: string }>
  ): number {
    const baseRisk = 100 - source.healthScore;
    const exposureMultiplier = affected.filter(a => a.riskExposure === 'high').length * 10;
    return Math.min(100, baseRisk + exposureMultiplier);
  }

  private identifyRiskType(
    account: CustomerFamilyMember
  ): 'usage_drop' | 'health_decline' | 'support_escalation' | 'champion_loss' {
    if (account.healthTrend === 'down') return 'health_decline';
    if (account.riskSignals.includes('Low health score')) return 'health_decline';
    return 'usage_drop';
  }

  private generateRiskRecommendation(
    source: CustomerFamilyMember,
    affected: Array<{ name: string; riskExposure: string }>
  ): string {
    const highRiskNames = affected.filter(a => a.riskExposure === 'high').map(a => a.name);
    if (highRiskNames.length > 0) {
      return `Prioritize intervention at ${source.name} to prevent risk spreading to ${highRiskNames.join(', ')}. Schedule coordinated check-ins with all at-risk accounts.`;
    }
    return `Address issues at ${source.name} proactively and monitor related accounts for similar patterns.`;
  }

  private async getRecentSuccessfulPlaybook(customerId: string): Promise<any | null> {
    if (!supabase) {
      // Return mock playbook
      return {
        id: 'playbook-001',
        name: 'Advanced Training Rollout',
        completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        healthDelta: 18,
        usageDelta: 45,
        adoptionDelta: 35,
        metrics: {
          dailyActiveUsers: { before: 25, after: 45 },
          featureAdoption: { before: 40, after: 75 },
        },
      };
    }

    const { data, error } = await supabase
      .from('playbook_executions')
      .select('*')
      .eq('customer_id', customerId)
      .eq('outcome', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.playbook_id,
      name: data.playbook_name,
      completedAt: data.completed_at,
      healthDelta: (data.metrics_after?.healthScore || 0) - (data.metrics_before?.healthScore || 0),
      usageDelta: 30, // Would calculate from metrics
      adoptionDelta: 25,
      metrics: data.metrics_after || {},
    };
  }

  private calculatePlaybookFit(
    successful: CustomerFamilyMember,
    candidate: CustomerFamilyMember,
    playbook: any
  ): number {
    // Simplified fit calculation
    let fit = 50;

    // Same relationship type is a good indicator
    if (successful.relationshipType === candidate.relationshipType) {
      fit += 20;
    }

    // Similar starting health scores
    const healthDiff = Math.abs(successful.healthScore - candidate.healthScore);
    if (healthDiff < 20) {
      fit += 15;
    }

    // Candidate has room for improvement
    if (candidate.healthScore < 70) {
      fit += 10;
    }

    return Math.min(100, fit);
  }

  private identifyMissingElements(candidate: CustomerFamilyMember, playbook: any): string[] {
    const missing: string[] = [];

    if (candidate.healthScore < 50) {
      missing.push('Address critical health issues first');
    }

    if (candidate.lastContactDays > 14) {
      missing.push('Re-establish regular contact');
    }

    missing.push('Complete prerequisite training');

    return missing;
  }

  private mapPatternFromDb(row: any): MultiAccountPattern {
    return {
      id: row.id,
      parentCustomerId: row.parent_customer_id,
      parentCustomerName: row.parent_customer_name,
      patternType: row.pattern_type,
      affectedCustomers: row.affected_customers,
      details: row.details,
      severity: row.severity,
      confidenceScore: row.confidence_score,
      recommendation: row.recommendation,
      status: row.status,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      detectedAt: row.detected_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================
  // Mock Data
  // ============================================

  private async getMockFamilies(): Promise<CustomerFamily[]> {
    return [
      {
        parentCustomerId: 'parent-001',
        parentName: 'GlobalCorp',
        totalArr: 450000,
        aggregatedHealthScore: 72,
        healthTrend: 'stable',
        children: [
          {
            customerId: 'child-001',
            name: 'GlobalCorp EMEA',
            relationshipType: 'region',
            arr: 150000,
            healthScore: 92,
            healthTrend: 'up',
            stage: 'active',
            csmName: 'Sarah Johnson',
            lastContactDays: 3,
            riskSignals: [],
          },
          {
            customerId: 'child-002',
            name: 'GlobalCorp APAC',
            relationshipType: 'region',
            arr: 180000,
            healthScore: 65,
            healthTrend: 'stable',
            stage: 'active',
            csmName: 'Mike Chen',
            lastContactDays: 7,
            riskSignals: [],
          },
          {
            customerId: 'child-003',
            name: 'GlobalCorp LATAM',
            relationshipType: 'region',
            arr: 120000,
            healthScore: 58,
            healthTrend: 'down',
            stage: 'at_risk',
            csmName: 'Maria Garcia',
            lastContactDays: 14,
            riskSignals: ['Low health score', 'Declining usage'],
          },
        ],
      },
      {
        parentCustomerId: 'parent-002',
        parentName: 'TechIndustries Inc',
        totalArr: 320000,
        aggregatedHealthScore: 78,
        healthTrend: 'improving',
        children: [
          {
            customerId: 'child-004',
            name: 'TechIndustries - Consumer',
            relationshipType: 'division',
            arr: 160000,
            healthScore: 82,
            healthTrend: 'up',
            stage: 'active',
            csmName: 'John Smith',
            lastContactDays: 5,
            riskSignals: [],
          },
          {
            customerId: 'child-005',
            name: 'TechIndustries - Enterprise',
            relationshipType: 'division',
            arr: 160000,
            healthScore: 74,
            healthTrend: 'up',
            stage: 'active',
            csmName: 'Emily Brown',
            lastContactDays: 2,
            riskSignals: [],
          },
        ],
      },
    ];
  }

  private async getMockPatterns(options: GetPatternsOptions): Promise<MultiAccountPattern[]> {
    const mockPatterns: MultiAccountPattern[] = [
      {
        id: 'pattern-001',
        parentCustomerId: 'parent-001',
        parentCustomerName: 'GlobalCorp',
        patternType: 'replication_opportunity',
        affectedCustomers: ['child-001', 'child-002', 'child-003'],
        details: {
          type: 'replication_opportunity',
          data: {
            successfulCustomerId: 'child-001',
            successfulCustomerName: 'GlobalCorp EMEA',
            playbook: {
              id: 'playbook-training',
              name: 'Advanced Training Rollout',
              completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
            improvements: {
              healthScoreDelta: 18,
              usageDelta: 45,
              adoptionDelta: 35,
              specificMetrics: {},
            },
            candidateAccounts: [
              {
                customerId: 'child-002',
                name: 'GlobalCorp APAC',
                currentHealth: 65,
                fitScore: 85,
                missingElements: ['Schedule training sessions'],
                potentialGain: 19,
              },
              {
                customerId: 'child-003',
                name: 'GlobalCorp LATAM',
                currentHealth: 58,
                fitScore: 75,
                missingElements: ['Address onboarding gaps first', 'Schedule training'],
                potentialGain: 24,
              },
            ],
            successStory: 'GlobalCorp EMEA improved health score by 18 points through Advanced Training Rollout',
          },
        },
        severity: 'medium',
        confidenceScore: 80,
        recommendation: 'Replicate Advanced Training Rollout from GlobalCorp EMEA to GlobalCorp APAC, GlobalCorp LATAM',
        status: 'active',
        detectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'pattern-002',
        parentCustomerId: 'parent-001',
        parentCustomerName: 'GlobalCorp',
        patternType: 'risk_contagion',
        affectedCustomers: ['child-003', 'child-002'],
        details: {
          type: 'risk_contagion',
          data: {
            sourceCustomerId: 'child-003',
            sourceCustomerName: 'GlobalCorp LATAM',
            riskType: 'health_decline',
            riskSeverity: 'high',
            spreadRisk: 65,
            affectedAccounts: [
              {
                customerId: 'child-002',
                name: 'GlobalCorp APAC',
                currentHealth: 65,
                riskExposure: 'medium',
                sharedFactors: ['Same relationship type', 'Shared operational challenges'],
              },
            ],
            rootCause: 'Declining usage',
            timeline: 'Detected over last 30 days',
          },
        },
        severity: 'high',
        confidenceScore: 65,
        recommendation: 'Prioritize intervention at GlobalCorp LATAM to prevent risk spreading. Schedule coordinated check-ins with all regional accounts.',
        status: 'active',
        detectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Apply filters
    let filtered = mockPatterns;

    if (options.parentCustomerId) {
      filtered = filtered.filter(p => p.parentCustomerId === options.parentCustomerId);
    }
    if (options.patternTypes && options.patternTypes.length > 0) {
      filtered = filtered.filter(p => options.patternTypes!.includes(p.patternType));
    }
    if (options.status && options.status.length > 0) {
      filtered = filtered.filter(p => options.status!.includes(p.status));
    }
    if (options.severity && options.severity.length > 0) {
      filtered = filtered.filter(p => options.severity!.includes(p.severity));
    }

    return filtered;
  }
}

// Export singleton instance
export const multiAccountPatternService = new MultiAccountPatternService();
export default multiAccountPatternService;

// Re-export types
export * from './types.js';
