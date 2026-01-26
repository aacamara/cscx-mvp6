/**
 * Skills Layer Types
 * Production-grade type definitions for the CSCX.AI Skills system
 */

// ============================================
// Core Skill Types
// ============================================

export interface SkillVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'array';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
  };
}

export interface SkillStep {
  id: string;
  name: string;
  description: string;
  tool: string;
  requiresApproval: boolean;
  inputMapper: (context: SkillContext) => Record<string, any>;
  condition?: (context: SkillContext) => boolean; // Optional conditional execution
  retryable?: boolean;
  maxRetries?: number;
}

export interface SkillCacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  keyFields: string[]; // Which variables to use in cache key
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  keywords: string[];
  variables: SkillVariable[];
  steps: SkillStep[];
  cacheable: SkillCacheConfig;
  estimatedDurationSeconds: number;
  estimatedCostSavingsPercent: number; // When cached
}

export type SkillCategory =
  | 'onboarding'
  | 'communication'
  | 'analysis'
  | 'documentation'
  | 'scheduling'
  | 'renewal';

// ============================================
// Skill Context
// ============================================

export interface SkillContext {
  userId: string;
  customerId?: string;
  customer?: {
    id?: string;
    name?: string;
    primaryContact?: { name: string; email: string };
    arr?: number;
    healthScore?: number;
    tier?: string;
    industry?: string;
    renewalDate?: string;
    csmName?: string;
  };
  stakeholders?: Array<{ name: string; email: string; title: string }>;
  contract?: {
    companyName?: string;
    signedDate?: string;
    renewalDate?: string;
  };
  variables: Record<string, any>; // User-provided variables
}

// ============================================
// Execution Types
// ============================================

export type SkillStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'pending_approval'
  | 'failed'
  | 'skipped';

export interface SkillStepResult {
  stepId: string;
  stepName: string;
  status: SkillStepStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  result?: any;
  approvalId?: string;
  error?: string;
}

export interface SkillExecutionResult {
  executionId: string;
  skillId: string;
  skillName: string;
  success: boolean;
  fromCache: boolean;
  cacheKey?: string;
  steps: SkillStepResult[];
  pendingApprovals: string[];
  totalDurationMs: number;
  message: string;
  output?: any;
}

// ============================================
// Cache Types
// ============================================

export interface SkillCacheEntry {
  key: string;
  skillId: string;
  result: SkillExecutionResult;
  variables: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
  lastAccessedAt: Date;
}

export interface SkillCacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalSavedMs: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

// ============================================
// Metrics Types
// ============================================

export interface SkillExecutionMetrics {
  skillId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  cacheHits: number;
  cacheMisses: number;
  averageDurationMs: number;
  totalTimeSavedMs: number;
  lastExecutedAt?: Date;
}

export interface SkillMetricsAggregated {
  totalSkillsExecuted: number;
  totalTimeSavedMs: number;
  overallCacheHitRate: number;
  topSkillsByUsage: Array<{ skillId: string; count: number }>;
  topSkillsByTimeSaved: Array<{ skillId: string; savedMs: number }>;
}

// ============================================
// Registry Types
// ============================================

export interface SkillRegistryEntry {
  skill: Skill;
  enabled: boolean;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillSearchResult {
  skill: Skill;
  matchScore: number;
  matchedKeywords: string[];
}
