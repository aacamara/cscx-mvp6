/**
 * PRD-071: White Space Analysis Service
 *
 * Service for analyzing untapped opportunities within customer accounts:
 * - Product white space (unpurchased products, feature upgrades)
 * - User white space (unused licenses, department expansion)
 * - Use case white space (unrealized workflows, integrations)
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// ============================================
// Types (mirroring frontend types)
// ============================================

type ConfidenceLevel = 'high' | 'medium' | 'low';
type OpportunityCategory = 'products' | 'users' | 'use_cases';
type FocusArea = 'products' | 'users' | 'use_cases' | 'all';

interface ProductCatalogItem {
  id: string;
  name: string;
  description: string;
  annualPrice: number;
  category: 'core' | 'module' | 'add_on' | 'premium' | 'support';
  tier?: string;
  features?: string[];
}

interface WhiteSpaceAnalysis {
  customerId: string;
  customerName: string;
  generatedAt: string;
  totalPotentialValue: number;
  summary: Array<{
    category: OpportunityCategory;
    opportunityCount: number;
    potentialValue: number;
    readiness: 'high' | 'medium' | 'low';
  }>;
  categories: {
    products: any;
    users: any;
    useCases: any;
  };
  prioritizedOpportunities: any[];
  expansionProposal: any;
  peerComparison: any[];
  recommendations: string[];
}

// ============================================
// Product Catalog (Mock Data)
// ============================================

const PRODUCT_CATALOG: ProductCatalogItem[] = [
  {
    id: 'enterprise-platform',
    name: 'Enterprise Platform',
    description: 'Core platform with essential features',
    annualPrice: 100000,
    category: 'core',
    tier: 'enterprise',
  },
  {
    id: 'api-access',
    name: 'API Access',
    description: 'Full API access for integrations',
    annualPrice: 10000,
    category: 'module',
  },
  {
    id: 'analytics-module',
    name: 'Analytics Module',
    description: 'Advanced analytics and custom dashboards',
    annualPrice: 25000,
    category: 'module',
    features: ['Custom dashboards', 'Data visualization', 'Export capabilities'],
  },
  {
    id: 'white-labeling',
    name: 'White Labeling',
    description: 'Custom branding and white-label capabilities',
    annualPrice: 30000,
    category: 'premium',
  },
  {
    id: 'advanced-security',
    name: 'Advanced Security',
    description: 'SOC2 compliance, SSO, and advanced security features',
    annualPrice: 15000,
    category: 'add_on',
    features: ['SSO/SAML', 'Audit logs', 'IP restrictions', 'Encryption'],
  },
  {
    id: 'mobile-access',
    name: 'Mobile App Access',
    description: 'Native mobile app access for iOS and Android',
    annualPrice: 10000,
    category: 'add_on',
  },
  {
    id: 'premium-support',
    name: 'Premium Support',
    description: '24/7 priority support with dedicated CSM',
    annualPrice: 15000,
    category: 'support',
  },
  {
    id: 'ai-assistant',
    name: 'AI Assistant',
    description: 'AI-powered automation and recommendations',
    annualPrice: 20000,
    category: 'module',
  },
  {
    id: 'workflow-automation',
    name: 'Workflow Automation',
    description: 'Custom workflow builder and automation engine',
    annualPrice: 18000,
    category: 'module',
  },
  {
    id: 'data-warehouse',
    name: 'Data Warehouse Connector',
    description: 'Direct sync to Snowflake, BigQuery, Redshift',
    annualPrice: 12000,
    category: 'add_on',
  },
];

// Use cases with peer adoption rates
const USE_CASES = [
  { id: 'reporting-automation', name: 'Reporting Automation', category: 'core', peerAdoption: 90, potentialValue: 5000 },
  { id: 'workflow-automation', name: 'Workflow Automation', category: 'core', peerAdoption: 85, potentialValue: 8000 },
  { id: 'data-integration', name: 'Data Integration', category: 'core', peerAdoption: 75, potentialValue: 6000 },
  { id: 'customer-analytics', name: 'Customer Analytics', category: 'analytics', peerAdoption: 60, potentialValue: 15000 },
  { id: 'predictive-alerts', name: 'Predictive Alerts', category: 'advanced', peerAdoption: 45, potentialValue: 10000 },
  { id: 'external-sharing', name: 'External Sharing', category: 'collaboration', peerAdoption: 55, potentialValue: 10000 },
  { id: 'mobile-workflows', name: 'Mobile Workflows', category: 'mobile', peerAdoption: 42, potentialValue: 8000 },
  { id: 'ai-recommendations', name: 'AI Recommendations', category: 'advanced', peerAdoption: 35, potentialValue: 12000 },
];

// Departments for penetration analysis
const DEPARTMENTS = [
  { name: 'Operations', potentialUsers: 80, pricePerUser: 500 },
  { name: 'Engineering', potentialUsers: 45, pricePerUser: 500 },
  { name: 'Finance', potentialUsers: 20, pricePerUser: 500 },
  { name: 'Marketing', potentialUsers: 35, pricePerUser: 500 },
  { name: 'HR', potentialUsers: 15, pricePerUser: 500 },
  { name: 'Sales', potentialUsers: 40, pricePerUser: 500 },
  { name: 'Customer Success', potentialUsers: 25, pricePerUser: 500 },
  { name: 'Product', potentialUsers: 30, pricePerUser: 500 },
];

// ============================================
// Service Implementation
// ============================================

class WhiteSpaceAnalysisService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Generate comprehensive white space analysis for a customer
   */
  async analyzeWhiteSpace(
    customerId: string,
    focusArea: FocusArea = 'all'
  ): Promise<WhiteSpaceAnalysis | null> {
    try {
      // Fetch customer data
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        console.error(`[WhiteSpace] Customer not found: ${customerId}`);
        return null;
      }

      // Fetch related data in parallel
      const [
        purchasedProducts,
        usageData,
        stakeholders,
        signals,
        contractData,
      ] = await Promise.all([
        this.getPurchasedProducts(customerId),
        this.getUsageData(customerId),
        this.getStakeholders(customerId),
        this.getSignals(customerId),
        this.getContractData(customerId),
      ]);

      // Analyze each category
      const productWhiteSpace = focusArea === 'all' || focusArea === 'products'
        ? this.analyzeProductWhiteSpace(purchasedProducts, signals, customer)
        : { currentProducts: [], availableProducts: [], opportunities: [], totalPotentialValue: 0 };

      const userWhiteSpace = focusArea === 'all' || focusArea === 'users'
        ? this.analyzeUserWhiteSpace(usageData, stakeholders, contractData, customer)
        : { licenseUtilization: [], departmentPenetration: [], opportunities: [], totalPotentialValue: 0, licenseSummary: { totalLicensed: 0, totalActive: 0, overallUtilization: 0 } };

      const useCaseWhiteSpace = focusArea === 'all' || focusArea === 'use_cases'
        ? this.analyzeUseCaseWhiteSpace(usageData, purchasedProducts, customer)
        : { realizedUseCases: [], unrealizedUseCases: [], opportunities: [], totalPotentialValue: 0 };

      // Calculate totals
      const totalPotentialValue =
        productWhiteSpace.totalPotentialValue +
        userWhiteSpace.totalPotentialValue +
        useCaseWhiteSpace.totalPotentialValue;

      // Generate summary
      const summary = this.generateSummary(productWhiteSpace, userWhiteSpace, useCaseWhiteSpace);

      // Prioritize opportunities across all categories
      const prioritizedOpportunities = this.prioritizeOpportunities(
        productWhiteSpace,
        userWhiteSpace,
        useCaseWhiteSpace
      );

      // Generate expansion proposal
      const expansionProposal = this.generateExpansionProposal(prioritizedOpportunities);

      // Generate peer comparison
      const peerComparison = this.generatePeerComparison(
        purchasedProducts,
        userWhiteSpace.departmentPenetration,
        useCaseWhiteSpace.realizedUseCases
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        prioritizedOpportunities,
        peerComparison,
        customer
      );

      return {
        customerId,
        customerName: customer.name,
        generatedAt: new Date().toISOString(),
        totalPotentialValue,
        summary,
        categories: {
          products: productWhiteSpace,
          users: userWhiteSpace,
          useCases: useCaseWhiteSpace,
        },
        prioritizedOpportunities,
        expansionProposal,
        peerComparison,
        recommendations,
      };
    } catch (error) {
      console.error('[WhiteSpace] Analysis error:', error);
      return null;
    }
  }

  /**
   * Analyze product white space
   */
  private analyzeProductWhiteSpace(
    purchasedProducts: any[],
    signals: any[],
    customer: any
  ): any {
    const purchasedIds = new Set(purchasedProducts.map(p => p.productId || p.id));

    // Find unpurchased products
    const availableProducts = PRODUCT_CATALOG.filter(p => !purchasedIds.has(p.id));

    // Score each opportunity
    const opportunities = availableProducts.map(product => {
      const relevantSignals = this.findRelevantSignals(product, signals);
      const confidence = this.calculateConfidence(relevantSignals.length, customer);
      const relevanceScore = this.calculateRelevanceScore(product, relevantSignals, customer);

      return {
        product,
        opportunityType: this.getProductOpportunityType(product) as any,
        potentialValue: product.annualPrice,
        confidence,
        relevanceScore,
        signals: relevantSignals,
        whyItFits: this.generateWhyItFits(product, relevantSignals, customer),
        approach: this.generateApproach(product, customer),
      };
    });

    // Sort by relevance score
    opportunities.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const currentProducts = purchasedProducts.map(p => ({
      productId: p.productId || p.id,
      productName: p.productName || p.name,
      annualValue: p.annualValue || p.annualPrice || 0,
      purchaseDate: p.purchaseDate || p.created_at || new Date().toISOString(),
      status: 'active' as const,
    }));

    return {
      currentProducts,
      availableProducts,
      opportunities: opportunities.slice(0, 5), // Top 5 opportunities
      totalPotentialValue: opportunities.reduce((sum, o) => sum + o.potentialValue, 0),
    };
  }

  /**
   * Analyze user white space
   */
  private analyzeUserWhiteSpace(
    usageData: any,
    stakeholders: any[],
    contractData: any,
    customer: any
  ): any {
    // Calculate license utilization
    const licensedUsers = contractData?.licensedUsers || 200;
    const activeUsers = usageData?.activeUsers || 145;

    const licenseUtilization = [
      {
        type: 'Full Users',
        licensed: licensedUsers,
        active: activeUsers,
        utilization: Math.round((activeUsers / licensedUsers) * 100),
        available: licensedUsers - activeUsers,
      },
      {
        type: 'Admin Users',
        licensed: contractData?.adminLicenses || 10,
        active: Math.min(contractData?.adminLicenses || 10, 5),
        utilization: 50,
        available: 5,
      },
    ];

    // Analyze department penetration
    const activeDepartments = new Set(stakeholders.map(s => s.department).filter(Boolean));

    const departmentPenetration = DEPARTMENTS.map(dept => {
      const isUsing = activeDepartments.has(dept.name);
      const deptStakeholders = stakeholders.filter(s => s.department === dept.name);

      return {
        department: dept.name,
        isUsing,
        status: isUsing ? 'active' as const : 'not_using' as const,
        potentialUsers: dept.potentialUsers,
        potentialValue: isUsing ? 0 : dept.potentialUsers * dept.pricePerUser,
        champion: deptStakeholders[0]?.name,
        championRelationship: deptStakeholders[0]?.relationship,
      };
    });

    // Generate opportunities for non-using departments
    const opportunities = departmentPenetration
      .filter(d => !d.isUsing)
      .map(dept => ({
        department: dept.department,
        potentialUsers: dept.potentialUsers,
        potentialValue: dept.potentialValue,
        confidence: this.calculateDeptConfidence(dept, stakeholders) as ConfidenceLevel,
        relevanceScore: this.calculateDeptRelevanceScore(dept, stakeholders, customer),
        opportunityType: 'department_expansion' as const,
        signals: this.generateDeptSignals(dept, stakeholders),
        whyItFits: this.generateDeptWhyItFits(dept, stakeholders),
        approach: this.generateDeptApproach(dept, stakeholders),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      licenseUtilization,
      departmentPenetration,
      opportunities: opportunities.slice(0, 4),
      totalPotentialValue: opportunities.reduce((sum, o) => sum + o.potentialValue, 0),
      licenseSummary: {
        totalLicensed: licensedUsers,
        totalActive: activeUsers,
        overallUtilization: Math.round((activeUsers / licensedUsers) * 100),
      },
    };
  }

  /**
   * Analyze use case white space
   */
  private analyzeUseCaseWhiteSpace(
    usageData: any,
    purchasedProducts: any[],
    customer: any
  ): any {
    const adoptedUseCases = usageData?.adoptedUseCases || ['reporting-automation', 'workflow-automation', 'data-integration'];
    const adoptedSet = new Set(adoptedUseCases);

    const useCaseAdoption = USE_CASES.map(uc => ({
      useCase: {
        id: uc.id,
        name: uc.name,
        description: `${uc.name} capabilities`,
        category: uc.category,
        potentialValue: uc.potentialValue,
      },
      isAdopted: adoptedSet.has(uc.id),
      adoptionLevel: adoptedSet.has(uc.id) ? 'active' as const : 'not_adopted' as const,
      peerAdoptionPercent: uc.peerAdoption,
    }));

    const realized = useCaseAdoption.filter(u => u.isAdopted);
    const unrealized = useCaseAdoption.filter(u => !u.isAdopted);

    // Generate opportunities for unrealized use cases
    const opportunities = unrealized
      .map(uc => ({
        useCase: uc.useCase,
        peerAdoptionPercent: uc.peerAdoptionPercent,
        potentialValue: uc.useCase.potentialValue,
        confidence: this.calculateUseCaseConfidence(uc, purchasedProducts) as ConfidenceLevel,
        relevanceScore: this.calculateUseCaseRelevanceScore(uc, customer),
        opportunityType: 'unrealized_use_case' as const,
        signals: this.generateUseCaseSignals(uc),
        whyItFits: this.generateUseCaseWhyItFits(uc, customer),
        approach: this.generateUseCaseApproach(uc),
        relatedProducts: this.getRelatedProducts(uc.useCase.category),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      realizedUseCases: realized,
      unrealizedUseCases: unrealized,
      opportunities: opportunities.slice(0, 4),
      totalPotentialValue: opportunities.reduce((sum, o) => sum + o.potentialValue, 0),
    };
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(
    productWS: any,
    userWS: any,
    useCaseWS: any
  ): Array<{ category: OpportunityCategory; opportunityCount: number; potentialValue: number; readiness: 'high' | 'medium' | 'low' }> {
    return [
      {
        category: 'products',
        opportunityCount: productWS.opportunities.length,
        potentialValue: productWS.totalPotentialValue,
        readiness: productWS.opportunities[0]?.confidence || 'medium',
      },
      {
        category: 'users',
        opportunityCount: userWS.opportunities.length,
        potentialValue: userWS.totalPotentialValue,
        readiness: userWS.opportunities[0]?.confidence || 'medium',
      },
      {
        category: 'use_cases',
        opportunityCount: useCaseWS.opportunities.length,
        potentialValue: useCaseWS.totalPotentialValue,
        readiness: useCaseWS.opportunities[0]?.confidence || 'medium',
      },
    ];
  }

  /**
   * Prioritize opportunities across all categories
   */
  private prioritizeOpportunities(
    productWS: any,
    userWS: any,
    useCaseWS: any
  ): any[] {
    const allOpportunities: any[] = [];

    // Add product opportunities
    productWS.opportunities.forEach((o: any) => {
      allOpportunities.push({
        id: uuidv4(),
        category: 'products' as OpportunityCategory,
        type: o.opportunityType,
        name: o.product.name,
        description: o.product.description,
        potentialValue: o.potentialValue,
        confidence: o.confidence,
        relevanceScore: o.relevanceScore,
        signals: o.signals.map((s: any) => s.content),
        nextSteps: o.approach,
        whyItFits: o.whyItFits,
      });
    });

    // Add user opportunities
    userWS.opportunities.forEach((o: any) => {
      allOpportunities.push({
        id: uuidv4(),
        category: 'users' as OpportunityCategory,
        type: o.opportunityType,
        name: `${o.department} Department`,
        description: `Expand to ${o.department} with ${o.potentialUsers} potential users`,
        potentialValue: o.potentialValue,
        confidence: o.confidence,
        relevanceScore: o.relevanceScore,
        signals: o.signals.map((s: any) => s.content),
        nextSteps: o.approach,
        whyItFits: o.whyItFits,
      });
    });

    // Add use case opportunities
    useCaseWS.opportunities.forEach((o: any) => {
      allOpportunities.push({
        id: uuidv4(),
        category: 'use_cases' as OpportunityCategory,
        type: o.opportunityType,
        name: o.useCase.name,
        description: `${o.peerAdoptionPercent}% of similar customers use this`,
        potentialValue: o.potentialValue,
        confidence: o.confidence,
        relevanceScore: o.relevanceScore,
        signals: o.signals.map((s: any) => s.content),
        nextSteps: o.approach,
        whyItFits: o.whyItFits,
      });
    });

    // Sort by weighted score
    return allOpportunities
      .sort((a, b) => {
        const scoreA = a.relevanceScore * (a.confidence === 'high' ? 1.2 : a.confidence === 'medium' ? 1.0 : 0.8);
        const scoreB = b.relevanceScore * (b.confidence === 'high' ? 1.2 : b.confidence === 'medium' ? 1.0 : 0.8);
        return scoreB - scoreA;
      })
      .slice(0, 10);
  }

  /**
   * Generate expansion proposal
   */
  private generateExpansionProposal(prioritizedOpportunities: any[]): any {
    // Select top 3-4 opportunities for proposal
    const topOpportunities = prioritizedOpportunities.slice(0, 4);

    const items = topOpportunities.map(o => {
      const discount = o.confidence === 'high' ? 15 : o.confidence === 'medium' ? 10 : 5;
      return {
        item: o.name,
        annualValue: o.potentialValue,
        discount,
        netValue: Math.round(o.potentialValue * (1 - discount / 100)),
        category: o.category,
      };
    });

    const totalAnnualValue = items.reduce((sum, i) => sum + i.annualValue, 0);
    const totalNetValue = items.reduce((sum, i) => sum + i.netValue, 0);

    return {
      items,
      totalAnnualValue,
      totalNetValue,
      valueProposition: [
        'Consolidate existing point solutions',
        'Unlock new capabilities across departments',
        'Future-proof your technology stack',
      ],
      timeline: {
        q1: items.slice(0, 2).map(i => i.item),
        q2: items.slice(2).map(i => i.item),
      },
    };
  }

  /**
   * Generate peer comparison
   */
  private generatePeerComparison(
    purchasedProducts: any[],
    departmentPenetration: any[],
    realizedUseCases: any[]
  ): any[] {
    const purchasedIds = new Set(purchasedProducts.map(p => p.productId || p.id));
    const activeDepts = departmentPenetration.filter(d => d.isUsing).length;

    return [
      {
        metric: 'Analytics Module',
        customerHas: purchasedIds.has('analytics-module'),
        peerPercent: 65,
        gap: purchasedIds.has('analytics-module') ? 'on_par' : 'under_penetrated',
      },
      {
        metric: 'Advanced Security',
        customerHas: purchasedIds.has('advanced-security'),
        peerPercent: 55,
        gap: purchasedIds.has('advanced-security') ? 'on_par' : 'under_penetrated',
      },
      {
        metric: 'Mobile Access',
        customerHas: purchasedIds.has('mobile-access'),
        peerPercent: 42,
        gap: purchasedIds.has('mobile-access') ? 'on_par' : 'under_penetrated',
      },
      {
        metric: '3+ Departments Using',
        customerHas: activeDepts >= 3,
        peerPercent: 70,
        gap: activeDepts >= 3 ? 'on_par' : 'under_penetrated',
      },
      {
        metric: 'AI Features Enabled',
        customerHas: purchasedIds.has('ai-assistant'),
        peerPercent: 35,
        gap: purchasedIds.has('ai-assistant') ? 'above_average' : 'on_par',
      },
    ];
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    prioritizedOpportunities: any[],
    peerComparison: any[],
    customer: any
  ): string[] {
    const recommendations: string[] = [];

    // Add recommendations based on top opportunities
    if (prioritizedOpportunities.length > 0) {
      const top = prioritizedOpportunities[0];
      recommendations.push(
        `Start with ${top.name} - highest relevance score and ${top.confidence} confidence`
      );
    }

    // Add recommendations based on peer comparison
    const underPenetrated = peerComparison.filter(p => p.gap === 'under_penetrated');
    if (underPenetrated.length > 0) {
      recommendations.push(
        `${customer.name} is under-penetrated vs peers in: ${underPenetrated.map(p => p.metric).join(', ')}`
      );
    }

    // Add bundle recommendation
    if (prioritizedOpportunities.length >= 3) {
      recommendations.push(
        'Consider bundling top 3 opportunities for better pricing and faster adoption'
      );
    }

    // Add timing recommendation
    if (customer.renewal_date) {
      const renewalDate = new Date(customer.renewal_date);
      const daysToRenewal = Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysToRenewal <= 90 && daysToRenewal > 0) {
        recommendations.push(
          `Renewal in ${daysToRenewal} days - ideal time to present expansion package`
        );
      }
    }

    return recommendations.slice(0, 5);
  }

  // ============================================
  // Helper Methods
  // ============================================

  private findRelevantSignals(product: ProductCatalogItem, signals: any[]): any[] {
    const keywords = product.name.toLowerCase().split(' ');
    return signals
      .filter((s: any) => {
        const content = (s.content || s.text || '').toLowerCase();
        return keywords.some(kw => content.includes(kw));
      })
      .slice(0, 3)
      .map((s: any) => ({
        type: s.type || 'meeting',
        source: s.source || 'Meeting',
        content: s.content || s.text || '',
        date: s.date || s.created_at || new Date().toISOString(),
      }));
  }

  private calculateConfidence(signalCount: number, customer: any): ConfidenceLevel {
    if (signalCount >= 3) return 'high';
    if (signalCount >= 1) return 'medium';
    return 'low';
  }

  private calculateRelevanceScore(product: ProductCatalogItem, signals: any[], customer: any): number {
    let score = 50; // Base score

    // Signal strength (0-25 points)
    score += Math.min(signals.length * 8, 25);

    // Customer health correlation (0-15 points)
    if (customer.health_score >= 70) score += 15;
    else if (customer.health_score >= 50) score += 10;
    else score += 5;

    // ARR tier correlation (0-10 points)
    if (customer.arr >= 100000) score += 10;
    else if (customer.arr >= 50000) score += 7;
    else score += 3;

    return Math.min(score, 100);
  }

  private getProductOpportunityType(product: ProductCatalogItem): string {
    switch (product.category) {
      case 'core': return 'unpurchased_product';
      case 'module': return 'add_on_module';
      case 'premium': return 'tier_upgrade';
      case 'add_on': return 'feature_upgrade';
      case 'support': return 'tier_upgrade';
      default: return 'unpurchased_product';
    }
  }

  private generateWhyItFits(product: ProductCatalogItem, signals: any[], customer: any): string[] {
    const reasons: string[] = [];

    if (signals.length > 0) {
      reasons.push(`Interest signals detected in recent interactions`);
    }

    if (product.category === 'module') {
      reasons.push('Complements existing product usage patterns');
    }

    if (customer.health_score >= 70) {
      reasons.push('Strong engagement indicates readiness for expansion');
    }

    reasons.push(`Similar customers see significant ROI with this product`);

    return reasons.slice(0, 4);
  }

  private generateApproach(product: ProductCatalogItem, customer: any): string[] {
    return [
      `Schedule demo with key stakeholders`,
      `Prepare ROI analysis for ${product.name}`,
      `Propose pilot with power users`,
      `Create custom implementation timeline`,
    ];
  }

  private calculateDeptConfidence(dept: any, stakeholders: any[]): ConfidenceLevel {
    const hasConnection = stakeholders.some(s =>
      s.department === dept.department ||
      s.relationships?.includes(dept.department)
    );
    if (hasConnection) return 'high';
    return 'medium';
  }

  private calculateDeptRelevanceScore(dept: any, stakeholders: any[], customer: any): number {
    let score = 50;

    // Connection to champions (0-25)
    if (stakeholders.some(s => s.is_champion)) score += 25;
    else if (stakeholders.length > 0) score += 15;

    // Department size (0-15)
    if (dept.potentialUsers >= 50) score += 15;
    else if (dept.potentialUsers >= 20) score += 10;
    else score += 5;

    // Health score (0-10)
    if (customer.health_score >= 70) score += 10;
    else if (customer.health_score >= 50) score += 5;

    return Math.min(score, 100);
  }

  private generateDeptSignals(dept: any, stakeholders: any[]): any[] {
    return [
      { type: 'qbr_mention', source: 'QBR', content: `${dept.department} mentioned as potential expansion area`, date: new Date().toISOString() },
      { type: 'workflow_overlap', source: 'Analysis', content: `Use case overlap with Operations workflows`, date: new Date().toISOString() },
    ];
  }

  private generateDeptWhyItFits(dept: any, stakeholders: any[]): string[] {
    return [
      `${dept.department} has use cases aligned with current usage`,
      'Champion has relationship with department leadership',
      'Similar workflow patterns to currently active departments',
    ];
  }

  private generateDeptApproach(dept: any, stakeholders: any[]): string[] {
    const champion = stakeholders.find(s => s.is_champion);
    return [
      champion ? `Request introduction from ${champion.name}` : 'Identify internal champion for introduction',
      `Propose pilot with 5 ${dept.department} users`,
      `Focus on specific use case relevant to ${dept.department}`,
    ];
  }

  private calculateUseCaseConfidence(uc: any, purchasedProducts: any[]): ConfidenceLevel {
    if (uc.peerAdoptionPercent >= 60) return 'high';
    if (uc.peerAdoptionPercent >= 40) return 'medium';
    return 'low';
  }

  private calculateUseCaseRelevanceScore(uc: any, customer: any): number {
    let score = 40;

    // Peer adoption (0-30)
    score += Math.round(uc.peerAdoptionPercent * 0.3);

    // Customer health (0-20)
    if (customer.health_score >= 70) score += 20;
    else if (customer.health_score >= 50) score += 10;

    // Value potential (0-10)
    if (uc.useCase.potentialValue >= 10000) score += 10;
    else if (uc.useCase.potentialValue >= 5000) score += 5;

    return Math.min(score, 100);
  }

  private generateUseCaseSignals(uc: any): any[] {
    return [
      { type: 'peer_comparison', source: 'Analysis', content: `${uc.peerAdoptionPercent}% of similar customers use this`, date: new Date().toISOString() },
      { type: 'data_flow', source: 'Platform', content: 'Existing data patterns support this use case', date: new Date().toISOString() },
    ];
  }

  private generateUseCaseWhyItFits(uc: any, customer: any): string[] {
    return [
      `High peer adoption (${uc.peerAdoptionPercent}%) indicates market validation`,
      'Builds on existing platform capabilities',
      'Potential for quick time-to-value',
    ];
  }

  private generateUseCaseApproach(uc: any): string[] {
    return [
      'Present use case success stories',
      'Calculate ROI based on similar customers',
      'Create implementation roadmap',
    ];
  }

  private getRelatedProducts(category: string): string[] {
    const productMap: Record<string, string[]> = {
      'analytics': ['analytics-module', 'data-warehouse'],
      'advanced': ['ai-assistant', 'workflow-automation'],
      'mobile': ['mobile-access'],
      'collaboration': ['white-labeling'],
    };
    return productMap[category] || [];
  }

  // ============================================
  // Data Fetching Methods
  // ============================================

  private async getCustomer(customerId: string): Promise<any> {
    if (!this.supabase) {
      return {
        id: customerId,
        name: 'Sample Customer',
        arr: 120000,
        health_score: 75,
        stage: 'active',
        industry: 'Technology',
        renewal_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    try {
      const { data, error } = await this.supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[WhiteSpace] Error fetching customer:', error);
      return null;
    }
  }

  private async getPurchasedProducts(customerId: string): Promise<any[]> {
    if (!this.supabase) {
      return [
        { productId: 'enterprise-platform', productName: 'Enterprise Platform', annualValue: 100000 },
        { productId: 'api-access', productName: 'API Access', annualValue: 10000 },
      ];
    }

    try {
      const { data, error } = await this.supabase
        .from('entitlements')
        .select('*')
        .eq('customer_id', customerId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[WhiteSpace] Error fetching products:', error);
      return [];
    }
  }

  private async getUsageData(customerId: string): Promise<any> {
    if (!this.supabase) {
      return {
        activeUsers: 145,
        adoptedUseCases: ['reporting-automation', 'workflow-automation', 'data-integration'],
        featureUsage: {},
      };
    }

    try {
      // Get active users count
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: activeUsers } = await this.supabase
        .from('usage_events')
        .select('user_id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .gte('timestamp', thirtyDaysAgo);

      return {
        activeUsers: activeUsers || 0,
        adoptedUseCases: ['reporting-automation', 'workflow-automation', 'data-integration'],
        featureUsage: {},
      };
    } catch (error) {
      console.error('[WhiteSpace] Error fetching usage:', error);
      return { activeUsers: 0, adoptedUseCases: [], featureUsage: {} };
    }
  }

  private async getStakeholders(customerId: string): Promise<any[]> {
    if (!this.supabase) {
      return [
        { name: 'Sarah Johnson', role: 'VP Operations', department: 'Operations', is_champion: true },
        { name: 'Mike Chen', role: 'Engineering Lead', department: 'Engineering', is_champion: false },
      ];
    }

    try {
      const { data, error } = await this.supabase
        .from('stakeholders')
        .select('*')
        .eq('customer_id', customerId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[WhiteSpace] Error fetching stakeholders:', error);
      return [];
    }
  }

  private async getSignals(customerId: string): Promise<any[]> {
    if (!this.supabase) {
      return [
        { type: 'meeting', content: 'Expressed interest in analytics capabilities', date: new Date().toISOString() },
        { type: 'feature_request', content: 'Requested custom reporting features', date: new Date().toISOString() },
        { type: 'support_ticket', content: 'Asked about SOC2 compliance options', date: new Date().toISOString() },
      ];
    }

    try {
      const { data, error } = await this.supabase
        .from('meeting_analyses')
        .select('*')
        .eq('customer_id', customerId)
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[WhiteSpace] Error fetching signals:', error);
      return [];
    }
  }

  private async getContractData(customerId: string): Promise<any> {
    if (!this.supabase) {
      return {
        licensedUsers: 200,
        adminLicenses: 10,
        contractEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    try {
      const { data, error } = await this.supabase
        .from('contracts')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || { licensedUsers: 200, adminLicenses: 10 };
    } catch (error) {
      console.error('[WhiteSpace] Error fetching contract:', error);
      return { licensedUsers: 200, adminLicenses: 10 };
    }
  }
}

// Export singleton
export const whiteSpaceAnalysisService = new WhiteSpaceAnalysisService();
export default whiteSpaceAnalysisService;
