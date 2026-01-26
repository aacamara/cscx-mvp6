/**
 * Skills API Routes
 * Endpoints for skill management, execution, and caching
 */

import { Router, Request, Response } from 'express';
import { skillRegistry } from '../agents/skills/registry.js';
import { skillExecutor } from '../agents/skills/executor.js';
import { skillCache } from '../services/skillCache.js';
import { SkillCategory, SkillContext } from '../agents/skills/types.js';

const router = Router();

// ============================================
// Skill Listing & Discovery
// ============================================

/**
 * GET /api/skills
 * List all available skills
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, enabled } = req.query;

    let skills = skillRegistry.getSummary();

    // Filter by category if specified
    if (category) {
      skills = skills.filter(s => s.category === category);
    }

    // Filter by enabled status if specified
    if (enabled !== undefined) {
      const enabledBool = enabled === 'true';
      skills = skills.filter(s => s.enabled === enabledBool);
    }

    res.json({
      success: true,
      skills,
      total: skills.length,
      categories: ['onboarding', 'communication', 'analysis', 'documentation', 'scheduling', 'renewal'],
    });
  } catch (error) {
    console.error('Error listing skills:', error);
    res.status(500).json({
      error: 'Failed to list skills',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/skills/search
 * Search skills by keyword
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    const results = skillRegistry.search(q);

    res.json({
      success: true,
      query: q,
      results: results.map(r => ({
        skill: {
          id: r.skill.id,
          name: r.skill.name,
          description: r.skill.description,
          icon: r.skill.icon,
          category: r.skill.category,
        },
        matchScore: r.matchScore,
        matchedKeywords: r.matchedKeywords,
      })),
      total: results.length,
    });
  } catch (error) {
    console.error('Error searching skills:', error);
    res.status(500).json({
      error: 'Failed to search skills',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/skills/categories
 * Get skill categories with counts
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories: SkillCategory[] = [
      'onboarding',
      'communication',
      'analysis',
      'documentation',
      'scheduling',
      'renewal',
    ];

    const categoryCounts = categories.map(category => ({
      category,
      count: skillRegistry.getByCategory(category).length,
      label: category.charAt(0).toUpperCase() + category.slice(1),
    }));

    res.json({
      success: true,
      categories: categoryCounts,
    });
  } catch (error) {
    console.error('Error listing categories:', error);
    res.status(500).json({
      error: 'Failed to list categories',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// Skill Details
// ============================================

/**
 * GET /api/skills/:id
 * Get detailed information about a specific skill
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const entry = skillRegistry.getEntry(id);

    if (!entry) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    const skill = entry.skill;
    const metrics = skillExecutor.getSkillMetrics(id);

    res.json({
      success: true,
      skill: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        icon: skill.icon,
        category: skill.category,
        keywords: skill.keywords,
        variables: skill.variables,
        steps: skill.steps.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          tool: s.tool,
          requiresApproval: s.requiresApproval,
        })),
        cacheable: skill.cacheable,
        estimatedDurationSeconds: skill.estimatedDurationSeconds,
        estimatedCostSavingsPercent: skill.estimatedCostSavingsPercent,
      },
      metadata: {
        enabled: entry.enabled,
        version: entry.version,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      },
      metrics: metrics || null,
    });
  } catch (error) {
    console.error('Error getting skill:', error);
    res.status(500).json({
      error: 'Failed to get skill',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// Skill Execution
// ============================================

/**
 * POST /api/skills/:id/execute
 * Execute a skill with provided variables
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const skill = skillRegistry.get(id);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    const entry = skillRegistry.getEntry(id);
    if (!entry?.enabled) {
      return res.status(400).json({ error: 'Skill is disabled' });
    }

    const { variables, customerId, customer, skipCache } = req.body;

    // Validate required variables
    const missingRequired = skill.variables
      .filter(v => v.required && !variables?.[v.name])
      .map(v => v.name);

    if (missingRequired.length > 0) {
      return res.status(400).json({
        error: 'Missing required variables',
        missingVariables: missingRequired,
        requiredVariables: skill.variables.filter(v => v.required),
      });
    }

    // Validate variable types
    for (const varDef of skill.variables) {
      const value = variables?.[varDef.name];
      if (value !== undefined && value !== null) {
        const validation = validateVariable(value, varDef);
        if (!validation.valid) {
          return res.status(400).json({
            error: `Invalid variable: ${varDef.name}`,
            details: validation.error,
          });
        }
      }
    }

    // Build context
    const context: SkillContext = {
      userId,
      customerId,
      customer: customer || {},
      variables: {
        ...Object.fromEntries(
          skill.variables
            .filter(v => v.defaultValue !== undefined)
            .map(v => [v.name, v.defaultValue])
        ),
        ...variables,
      },
    };

    // Execute the skill
    const result = await skillExecutor.execute(skill, context, { skipCache: skipCache === true });

    res.json({
      success: true,
      execution: result,
    });
  } catch (error) {
    console.error('Error executing skill:', error);
    res.status(500).json({
      error: 'Failed to execute skill',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/skills/:id/preview
 * Preview what a skill will do without executing
 */
router.post('/:id/preview', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const skill = skillRegistry.get(id);

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    const { variables } = req.body;

    // Build a preview context
    const previewContext: SkillContext = {
      userId: 'preview',
      variables: variables || {},
    };

    // Generate preview of what would happen
    const steps = skill.steps.map(step => {
      let conditionMet = true;
      if (step.condition) {
        try {
          conditionMet = step.condition(previewContext);
        } catch {
          conditionMet = false;
        }
      }

      let previewInput = {};
      try {
        previewInput = step.inputMapper(previewContext);
      } catch (e) {
        // Ignore mapping errors in preview
      }

      return {
        id: step.id,
        name: step.name,
        description: step.description,
        tool: step.tool,
        requiresApproval: step.requiresApproval,
        willExecute: conditionMet,
        previewInput,
      };
    });

    res.json({
      success: true,
      preview: {
        skillId: skill.id,
        skillName: skill.name,
        steps,
        estimatedDurationSeconds: skill.estimatedDurationSeconds,
        willBeCached: skill.cacheable.enabled,
        cacheTtlSeconds: skill.cacheable.ttlSeconds,
      },
    });
  } catch (error) {
    console.error('Error previewing skill:', error);
    res.status(500).json({
      error: 'Failed to preview skill',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// Cache Management
// ============================================

/**
 * GET /api/skills/:id/cache
 * Check cache status for a skill
 */
router.get('/:id/cache', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { variables } = req.query;

    const skill = skillRegistry.get(id);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    if (!skill.cacheable.enabled) {
      return res.json({
        success: true,
        cached: false,
        reason: 'Skill is not cacheable',
      });
    }

    let parsedVariables = {};
    if (variables && typeof variables === 'string') {
      try {
        parsedVariables = JSON.parse(variables);
      } catch {
        return res.status(400).json({ error: 'Invalid variables JSON' });
      }
    }

    const cacheKey = skillCache.generateCacheKey(id, parsedVariables, skill.cacheable.keyFields);
    const cached = await skillCache.hasValidCache(cacheKey);
    const ttl = skillCache.getTimeToExpiry(cacheKey);

    res.json({
      success: true,
      cached,
      cacheKey,
      ttlSeconds: ttl,
      cacheable: skill.cacheable,
    });
  } catch (error) {
    console.error('Error checking cache:', error);
    res.status(500).json({
      error: 'Failed to check cache',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/skills/:id/cache
 * Clear cache for a skill
 */
router.delete('/:id/cache', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { variables } = req.body;

    const skill = skillRegistry.get(id);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    let invalidated = 0;

    if (variables) {
      // Clear specific cache entry
      const cacheKey = skillCache.generateCacheKey(id, variables, skill.cacheable.keyFields);
      const existed = await skillCache.invalidate(cacheKey);
      invalidated = existed ? 1 : 0;
    } else {
      // Clear all cache entries for this skill
      invalidated = await skillCache.invalidateSkill(id);
    }

    res.json({
      success: true,
      invalidated,
      message: `Cleared ${invalidated} cache entry(s) for skill: ${id}`,
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/skills/cache/stats
 * Get global cache statistics
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const stats = skillCache.getStats();
    const metrics = skillCache.getMetrics();

    res.json({
      success: true,
      stats,
      metrics,
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      error: 'Failed to get cache stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// Skill Metrics
// ============================================

/**
 * GET /api/skills/:id/metrics
 * Get execution metrics for a skill
 */
router.get('/:id/metrics', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const skill = skillRegistry.get(id);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    const metrics = skillExecutor.getSkillMetrics(id);

    if (!metrics) {
      return res.json({
        success: true,
        metrics: null,
        message: 'No metrics available yet',
      });
    }

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({
      error: 'Failed to get metrics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/skills/metrics/all
 * Get aggregated metrics for all skills
 */
router.get('/metrics/all', async (req: Request, res: Response) => {
  try {
    const allMetrics = skillExecutor.getAllMetrics();

    let totalExecutions = 0;
    let totalTimeSaved = 0;
    let totalCacheHits = 0;
    let totalCacheMisses = 0;

    const skillMetrics: Array<{
      skillId: string;
      skillName: string;
      executions: number;
      successRate: number;
      cacheHitRate: number;
      avgDurationMs: number;
      timeSavedMs: number;
    }> = [];

    for (const [skillId, metrics] of allMetrics.entries()) {
      const skill = skillRegistry.get(skillId);

      totalExecutions += metrics.totalExecutions;
      totalTimeSaved += metrics.totalTimeSavedMs;
      totalCacheHits += metrics.cacheHits;
      totalCacheMisses += metrics.cacheMisses;

      const cacheAttempts = metrics.cacheHits + metrics.cacheMisses;

      skillMetrics.push({
        skillId,
        skillName: skill?.name || skillId,
        executions: metrics.totalExecutions,
        successRate: metrics.totalExecutions > 0
          ? metrics.successfulExecutions / metrics.totalExecutions
          : 0,
        cacheHitRate: cacheAttempts > 0 ? metrics.cacheHits / cacheAttempts : 0,
        avgDurationMs: Math.round(metrics.averageDurationMs),
        timeSavedMs: metrics.totalTimeSavedMs,
      });
    }

    const totalCacheAttempts = totalCacheHits + totalCacheMisses;

    res.json({
      success: true,
      summary: {
        totalExecutions,
        totalTimeSavedMs: totalTimeSaved,
        totalTimeSavedFormatted: formatDuration(totalTimeSaved),
        overallCacheHitRate: totalCacheAttempts > 0 ? totalCacheHits / totalCacheAttempts : 0,
      },
      bySkill: skillMetrics.sort((a, b) => b.executions - a.executions),
    });
  } catch (error) {
    console.error('Error getting all metrics:', error);
    res.status(500).json({
      error: 'Failed to get metrics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// Skill Management
// ============================================

/**
 * PATCH /api/skills/:id/enable
 * Enable a skill
 */
router.patch('/:id/enable', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!skillRegistry.has(id)) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    skillRegistry.setEnabled(id, true);

    res.json({
      success: true,
      message: `Skill ${id} enabled`,
    });
  } catch (error) {
    console.error('Error enabling skill:', error);
    res.status(500).json({
      error: 'Failed to enable skill',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/skills/:id/disable
 * Disable a skill
 */
router.patch('/:id/disable', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!skillRegistry.has(id)) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    skillRegistry.setEnabled(id, false);

    res.json({
      success: true,
      message: `Skill ${id} disabled`,
    });
  } catch (error) {
    console.error('Error disabling skill:', error);
    res.status(500).json({
      error: 'Failed to disable skill',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// Helpers
// ============================================

function validateVariable(
  value: any,
  varDef: { name: string; type: string; validation?: any }
): { valid: boolean; error?: string } {
  const { type, validation } = varDef;

  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Expected string' };
      }
      if (validation?.pattern && !new RegExp(validation.pattern).test(value)) {
        return { valid: false, error: `Does not match pattern: ${validation.pattern}` };
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { valid: false, error: 'Expected number' };
      }
      if (validation?.min !== undefined && value < validation.min) {
        return { valid: false, error: `Must be >= ${validation.min}` };
      }
      if (validation?.max !== undefined && value > validation.max) {
        return { valid: false, error: `Must be <= ${validation.max}` };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Expected boolean' };
      }
      break;

    case 'email':
      if (typeof value !== 'string' || !value.includes('@')) {
        return { valid: false, error: 'Expected valid email' };
      }
      break;

    case 'date':
      if (isNaN(new Date(value).getTime())) {
        return { valid: false, error: 'Expected valid date' };
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return { valid: false, error: 'Expected array' };
      }
      break;
  }

  if (validation?.options && !validation.options.includes(value)) {
    return { valid: false, error: `Must be one of: ${validation.options.join(', ')}` };
  }

  return { valid: true };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export default router;
