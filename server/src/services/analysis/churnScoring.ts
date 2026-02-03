/**
 * Churn Scoring Service
 * Calculates churn risk scores from uploaded CSV data
 *
 * Features:
 * - Configurable risk thresholds
 * - Multi-factor risk analysis
 * - Risk level classification (low/medium/high/critical)
 * - Primary concern identification for email personalization
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { ColumnMapping } from '../fileUpload/csvParser.js';

// Types
export interface RiskFactor {
  factor: string;
  description: string;
  weight: number;
  value: any;
  contribution: number; // Points contributed to risk score
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ChurnRiskScore {
  rowIndex: number;
  customerName: string;
  customerEmail?: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  primaryConcerns: string[];
  usageMetrics: Record<string, any>;
  rawData: Record<string, any>;
}

export interface ChurnAnalysisResult {
  fileId: string;
  totalRecords: number;
  analyzedRecords: number;
  summary: {
    lowRisk: number;
    mediumRisk: number;
    highRisk: number;
    criticalRisk: number;
    averageRiskScore: number;
  };
  patterns: string[];
  scores: ChurnRiskScore[];
}

export interface ChurnThresholds {
  // Days since last login thresholds
  loginDaysWarning: number;      // Default: 14
  loginDaysCritical: number;     // Default: 30

  // MAU change thresholds (percentage)
  mauDeclineWarning: number;     // Default: 20 (20% decline)
  mauDeclineCritical: number;    // Default: 40 (40% decline)

  // Support ticket thresholds
  ticketsWarning: number;        // Default: 3
  ticketsCritical: number;       // Default: 5

  // Health score thresholds
  healthScoreWarning: number;    // Default: 60
  healthScoreCritical: number;   // Default: 40

  // NPS thresholds
  npsWarning: number;            // Default: 6
  npsCritical: number;           // Default: 3

  // Overall risk level thresholds
  riskLevelMedium: number;       // Default: 40
  riskLevelHigh: number;         // Default: 70
  riskLevelCritical: number;     // Default: 85
}

const DEFAULT_THRESHOLDS: ChurnThresholds = {
  loginDaysWarning: 14,
  loginDaysCritical: 30,
  mauDeclineWarning: 20,
  mauDeclineCritical: 40,
  ticketsWarning: 3,
  ticketsCritical: 5,
  healthScoreWarning: 60,
  healthScoreCritical: 40,
  npsWarning: 6,
  npsCritical: 3,
  riskLevelMedium: 40,
  riskLevelHigh: 70,
  riskLevelCritical: 85
};

class ChurnScoringService {
  private supabase: SupabaseClient | null = null;
  private thresholds: ChurnThresholds = DEFAULT_THRESHOLDS;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Configure risk thresholds
   */
  setThresholds(thresholds: Partial<ChurnThresholds>): void {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Analyze all rows from a CSV for churn risk
   */
  async analyzeCSVData(
    fileId: string,
    rows: Record<string, any>[],
    mapping: ColumnMapping
  ): Promise<ChurnAnalysisResult> {
    const scores: ChurnRiskScore[] = [];
    let totalRiskScore = 0;
    const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    const detectedPatterns: Map<string, number> = new Map();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const score = this.calculateRiskScore(row, mapping, i);

      scores.push(score);
      totalRiskScore += score.riskScore;

      // Count risk levels
      if (score.riskLevel === 'low') riskCounts.low++;
      else if (score.riskLevel === 'medium') riskCounts.medium++;
      else if (score.riskLevel === 'high') riskCounts.high++;
      else riskCounts.critical++;

      // Track patterns
      for (const factor of score.riskFactors) {
        if (factor.severity === 'high' || factor.severity === 'critical') {
          const count = detectedPatterns.get(factor.factor) || 0;
          detectedPatterns.set(factor.factor, count + 1);
        }
      }
    }

    // Generate pattern descriptions
    const patterns: string[] = [];
    detectedPatterns.forEach((count, pattern) => {
      if (count >= 3) {
        patterns.push(`${count} accounts: ${pattern}`);
      }
    });

    // Sort by frequency
    patterns.sort((a, b) => {
      const countA = parseInt(a.split(' ')[0]);
      const countB = parseInt(b.split(' ')[0]);
      return countB - countA;
    });

    // Save scores to database if available
    if (this.supabase) {
      await this.saveChurnScores(fileId, scores);
    }

    return {
      fileId,
      totalRecords: rows.length,
      analyzedRecords: scores.length,
      summary: {
        lowRisk: riskCounts.low,
        mediumRisk: riskCounts.medium,
        highRisk: riskCounts.high,
        criticalRisk: riskCounts.critical,
        averageRiskScore: rows.length > 0 ? Math.round(totalRiskScore / rows.length) : 0
      },
      patterns,
      scores
    };
  }

  /**
   * Calculate risk score for a single row
   */
  calculateRiskScore(
    row: Record<string, any>,
    mapping: ColumnMapping,
    rowIndex: number
  ): ChurnRiskScore {
    const riskFactors: RiskFactor[] = [];
    let totalScore = 0;
    const usageMetrics: Record<string, any> = {};

    // Get mapped values
    const customerName = mapping.customerName ? row[mapping.customerName] : `Customer ${rowIndex + 1}`;
    const customerEmail = mapping.customerEmail ? row[mapping.customerEmail] : undefined;

    // Factor 1: Days since last login
    if (mapping.lastLoginDate) {
      const lastLogin = row[mapping.lastLoginDate];
      if (lastLogin) {
        const daysSinceLogin = this.calculateDaysSince(lastLogin);
        usageMetrics.daysSinceLogin = daysSinceLogin;

        if (daysSinceLogin > 0) {
          const factor = this.evaluateLoginDays(daysSinceLogin);
          if (factor) {
            riskFactors.push(factor);
            totalScore += factor.contribution;
          }
        }
      }
    }

    // Also check for explicit daysInactive column
    if (mapping.daysInactive) {
      const daysInactive = Number(row[mapping.daysInactive]) || 0;
      usageMetrics.daysInactive = daysInactive;

      if (daysInactive > 0 && !usageMetrics.daysSinceLogin) {
        const factor = this.evaluateLoginDays(daysInactive);
        if (factor) {
          riskFactors.push(factor);
          totalScore += factor.contribution;
        }
      }
    }

    // Factor 2: Monthly Active Users / Usage
    if (mapping.monthlyActiveUsers) {
      const mau = Number(row[mapping.monthlyActiveUsers]) || 0;
      usageMetrics.monthlyActiveUsers = mau;

      // Low absolute usage
      if (mau < 5) {
        const factor: RiskFactor = {
          factor: 'Low user adoption',
          description: `Only ${mau} monthly active users`,
          weight: 15,
          value: mau,
          contribution: 20,
          severity: mau === 0 ? 'critical' : 'high'
        };
        riskFactors.push(factor);
        totalScore += factor.contribution;
      }
    }

    // Factor 3: MAU/Usage Change/Trend
    if (mapping.usageChange) {
      const change = this.parsePercentage(row[mapping.usageChange]);
      usageMetrics.usageChange = change;

      if (change !== null && change < 0) {
        const factor = this.evaluateUsageChange(change);
        if (factor) {
          riskFactors.push(factor);
          totalScore += factor.contribution;
        }
      }
    }

    // Factor 4: Support Tickets
    if (mapping.supportTickets) {
      const tickets = Number(row[mapping.supportTickets]) || 0;
      usageMetrics.supportTickets = tickets;

      const factor = this.evaluateSupportTickets(tickets);
      if (factor) {
        riskFactors.push(factor);
        totalScore += factor.contribution;
      }
    }

    // Factor 5: Health Score
    if (mapping.healthScore) {
      const health = Number(row[mapping.healthScore]) || 0;
      usageMetrics.healthScore = health;

      const factor = this.evaluateHealthScore(health);
      if (factor) {
        riskFactors.push(factor);
        totalScore += factor.contribution;
      }
    }

    // Factor 6: NPS Score
    if (mapping.npsScore) {
      const nps = Number(row[mapping.npsScore]);
      if (!isNaN(nps)) {
        usageMetrics.npsScore = nps;

        const factor = this.evaluateNPSScore(nps);
        if (factor) {
          riskFactors.push(factor);
          totalScore += factor.contribution;
        }
      }
    }

    // Factor 7: Login Frequency
    if (mapping.loginFrequency) {
      const frequency = Number(row[mapping.loginFrequency]) || 0;
      usageMetrics.loginFrequency = frequency;

      if (frequency < 2) {
        const factor: RiskFactor = {
          factor: 'Low engagement frequency',
          description: `Only ${frequency} logins recently`,
          weight: 10,
          value: frequency,
          contribution: frequency === 0 ? 15 : 10,
          severity: frequency === 0 ? 'high' : 'medium'
        };
        riskFactors.push(factor);
        totalScore += factor.contribution;
      }
    }

    // Factor 8: ARR (high ARR = more attention needed)
    if (mapping.arr) {
      const arr = this.parseNumber(row[mapping.arr]);
      usageMetrics.arr = arr;

      // No additional risk from ARR, but track it
    }

    // Cap the score at 100
    const riskScore = Math.min(100, Math.max(0, totalScore));

    // Determine risk level
    const riskLevel = this.determineRiskLevel(riskScore);

    // Sort factors by contribution and get primary concerns
    riskFactors.sort((a, b) => b.contribution - a.contribution);
    const primaryConcerns = riskFactors
      .filter(f => f.severity === 'high' || f.severity === 'critical')
      .slice(0, 3)
      .map(f => f.factor);

    return {
      rowIndex,
      customerName: String(customerName || `Customer ${rowIndex + 1}`),
      customerEmail: customerEmail ? String(customerEmail) : undefined,
      riskScore,
      riskLevel,
      riskFactors,
      primaryConcerns,
      usageMetrics,
      rawData: row
    };
  }

  /**
   * Calculate days since a date
   */
  private calculateDaysSince(dateValue: any): number {
    let date: Date;

    if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return 0;
    }

    if (isNaN(date.getTime())) return 0;

    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Parse a percentage value
   */
  private parsePercentage(value: any): number | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') {
      // If it's already a decimal (0.6 = 60%), convert
      if (value >= -1 && value <= 1) return value * 100;
      return value;
    }

    if (typeof value === 'string') {
      const cleaned = value.replace(/[%,]/g, '').trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }

    return null;
  }

  /**
   * Parse a number that might have currency symbols
   */
  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[$,]/g, '').trim();
      return parseFloat(cleaned) || 0;
    }
    return 0;
  }

  /**
   * Evaluate login days factor
   */
  private evaluateLoginDays(days: number): RiskFactor | null {
    if (days >= this.thresholds.loginDaysCritical) {
      return {
        factor: 'Extended period of inactivity',
        description: `No login for ${days} days`,
        weight: 25,
        value: days,
        contribution: 30,
        severity: 'critical'
      };
    } else if (days >= this.thresholds.loginDaysWarning) {
      return {
        factor: 'Recent inactivity',
        description: `No login for ${days} days`,
        weight: 15,
        value: days,
        contribution: 15,
        severity: 'high'
      };
    }
    return null;
  }

  /**
   * Evaluate usage change factor
   */
  private evaluateUsageChange(changePercent: number): RiskFactor | null {
    const absChange = Math.abs(changePercent);

    if (absChange >= this.thresholds.mauDeclineCritical) {
      return {
        factor: 'Significant usage decline',
        description: `${absChange.toFixed(0)}% decrease in usage`,
        weight: 25,
        value: changePercent,
        contribution: 30,
        severity: 'critical'
      };
    } else if (absChange >= this.thresholds.mauDeclineWarning) {
      return {
        factor: 'Declining usage trend',
        description: `${absChange.toFixed(0)}% decrease in usage`,
        weight: 15,
        value: changePercent,
        contribution: 18,
        severity: 'high'
      };
    }
    return null;
  }

  /**
   * Evaluate support tickets factor
   */
  private evaluateSupportTickets(tickets: number): RiskFactor | null {
    if (tickets >= this.thresholds.ticketsCritical) {
      return {
        factor: 'High support ticket volume',
        description: `${tickets} open support tickets`,
        weight: 20,
        value: tickets,
        contribution: 20,
        severity: 'high'
      };
    } else if (tickets >= this.thresholds.ticketsWarning) {
      return {
        factor: 'Elevated support tickets',
        description: `${tickets} open support tickets`,
        weight: 10,
        value: tickets,
        contribution: 10,
        severity: 'medium'
      };
    }
    return null;
  }

  /**
   * Evaluate health score factor
   */
  private evaluateHealthScore(score: number): RiskFactor | null {
    if (score <= this.thresholds.healthScoreCritical) {
      return {
        factor: 'Critical health score',
        description: `Health score of ${score}/100`,
        weight: 25,
        value: score,
        contribution: 25,
        severity: 'critical'
      };
    } else if (score <= this.thresholds.healthScoreWarning) {
      return {
        factor: 'Low health score',
        description: `Health score of ${score}/100`,
        weight: 15,
        value: score,
        contribution: 15,
        severity: 'high'
      };
    }
    return null;
  }

  /**
   * Evaluate NPS score factor
   */
  private evaluateNPSScore(nps: number): RiskFactor | null {
    if (nps <= this.thresholds.npsCritical) {
      return {
        factor: 'Detractor NPS score',
        description: `NPS score of ${nps}/10`,
        weight: 20,
        value: nps,
        contribution: 20,
        severity: 'high'
      };
    } else if (nps <= this.thresholds.npsWarning) {
      return {
        factor: 'Passive NPS score',
        description: `NPS score of ${nps}/10`,
        weight: 10,
        value: nps,
        contribution: 10,
        severity: 'medium'
      };
    }
    return null;
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.thresholds.riskLevelCritical) return 'critical';
    if (score >= this.thresholds.riskLevelHigh) return 'high';
    if (score >= this.thresholds.riskLevelMedium) return 'medium';
    return 'low';
  }

  /**
   * Save churn scores to database
   */
  private async saveChurnScores(fileId: string, scores: ChurnRiskScore[]): Promise<void> {
    if (!this.supabase) return;

    const records = scores.map(score => ({
      source_file_id: fileId,
      row_index: score.rowIndex,
      customer_name: score.customerName,
      customer_email: score.customerEmail,
      raw_data: score.rawData,
      risk_score: score.riskScore,
      risk_level: score.riskLevel,
      risk_factors: score.riskFactors,
      primary_concerns: score.primaryConcerns,
      usage_metrics: score.usageMetrics
    }));

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await (this.supabase as any)
        .from('churn_risk_scores')
        .insert(batch);

      if (error) {
        console.error(`Failed to save churn scores batch ${i / batchSize + 1}:`, error);
      }
    }
  }

  /**
   * Get high-risk accounts from a file
   */
  async getHighRiskAccounts(
    fileId: string,
    threshold: number = 70
  ): Promise<ChurnRiskScore[]> {
    if (!this.supabase) return [];

    const { data, error } = await (this.supabase as any)
      .from('churn_risk_scores')
      .select('*')
      .eq('source_file_id', fileId)
      .gte('risk_score', threshold)
      .order('risk_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to get high-risk accounts: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      rowIndex: row.row_index,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      riskScore: row.risk_score,
      riskLevel: row.risk_level,
      riskFactors: row.risk_factors || [],
      primaryConcerns: row.primary_concerns || [],
      usageMetrics: row.usage_metrics || {},
      rawData: row.raw_data || {}
    }));
  }

  /**
   * Get risk score summary for a file
   */
  async getRiskSummary(fileId: string): Promise<ChurnAnalysisResult['summary'] | null> {
    if (!this.supabase) return null;

    const { data, error } = await (this.supabase as any)
      .from('churn_risk_scores')
      .select('risk_score, risk_level')
      .eq('source_file_id', fileId);

    if (error || !data) return null;

    const summary = {
      lowRisk: 0,
      mediumRisk: 0,
      highRisk: 0,
      criticalRisk: 0,
      averageRiskScore: 0
    };

    let totalScore = 0;
    for (const row of data) {
      totalScore += row.risk_score;
      switch (row.risk_level) {
        case 'low': summary.lowRisk++; break;
        case 'medium': summary.mediumRisk++; break;
        case 'high': summary.highRisk++; break;
        case 'critical': summary.criticalRisk++; break;
      }
    }

    summary.averageRiskScore = data.length > 0 ? Math.round(totalScore / data.length) : 0;
    return summary;
  }
}

// Singleton instance
export const churnScoringService = new ChurnScoringService();
export default churnScoringService;
