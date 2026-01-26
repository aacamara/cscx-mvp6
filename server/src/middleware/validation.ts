/**
 * Request Validation Middleware
 * Zod-based validation for agentic API requests
 * Includes input sanitization and detailed error messages
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

// ============================================================================
// Constants
// ============================================================================

export const VALIDATION_LIMITS = {
  GOAL_MAX_LENGTH: 1000,
  GOAL_MIN_LENGTH: 3,
  TASK_MAX_LENGTH: 500,
  CUSTOMER_ID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  STATE_ID_PATTERN: /^state_\d+$/,
  PLAN_ID_PATTERN: /^plan_[a-zA-Z0-9_-]+$/,
  AGENT_IDS: ['scheduler', 'communicator', 'researcher'] as const,
  PRESETS: ['manual', 'vacation', 'supervised', 'autonomous'] as const,
  AUTO_APPROVE_LEVELS: ['none', 'low_risk', 'all'] as const,
};

// Characters to strip from user input (prevent injection attacks)
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,  // Script tags
  /javascript:/gi,                                         // JavaScript protocol
  /on\w+\s*=/gi,                                          // Event handlers
  /data:/gi,                                              // Data URIs
  /vbscript:/gi,                                          // VBScript protocol
];

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Sanitize a string by removing dangerous patterns
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;

  let sanitized = input;

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Trim whitespace
  sanitized = sanitized.trim();

  // Normalize whitespace (collapse multiple spaces)
  sanitized = sanitized.replace(/\s+/g, ' ');

  return sanitized;
}

/**
 * Deep sanitize an object's string values
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObject(value);
    }
    return result as T;
  }

  return obj;
}

// ============================================================================
// Zod Schemas
// ============================================================================

// UUID validation schema
const uuidSchema = z.string().uuid('Invalid UUID format');

// Customer ID schema (UUID format)
export const customerIdSchema = z.string()
  .uuid('Invalid customer ID format. Must be a valid UUID.')
  .optional();

// State ID schema
export const stateIdSchema = z.string()
  .regex(VALIDATION_LIMITS.STATE_ID_PATTERN, 'Invalid state ID format');

// Goal schema
export const goalSchema = z.string()
  .min(VALIDATION_LIMITS.GOAL_MIN_LENGTH, `Goal must be at least ${VALIDATION_LIMITS.GOAL_MIN_LENGTH} characters`)
  .max(VALIDATION_LIMITS.GOAL_MAX_LENGTH, `Goal must not exceed ${VALIDATION_LIMITS.GOAL_MAX_LENGTH} characters`)
  .transform(sanitizeString);

// Task schema (for specialist endpoints)
export const taskSchema = z.string()
  .min(VALIDATION_LIMITS.GOAL_MIN_LENGTH, `Task must be at least ${VALIDATION_LIMITS.GOAL_MIN_LENGTH} characters`)
  .max(VALIDATION_LIMITS.TASK_MAX_LENGTH, `Task must not exceed ${VALIDATION_LIMITS.TASK_MAX_LENGTH} characters`)
  .transform(sanitizeString);

// Agent ID schema
export const agentIdSchema = z.enum(VALIDATION_LIMITS.AGENT_IDS, {
  errorMap: () => ({
    message: `Invalid agent. Must be one of: ${VALIDATION_LIMITS.AGENT_IDS.join(', ')}`,
  }),
});

// Preset schema
export const presetSchema = z.enum(VALIDATION_LIMITS.PRESETS, {
  errorMap: () => ({
    message: `Invalid preset. Must be one of: ${VALIDATION_LIMITS.PRESETS.join(', ')}`,
  }),
});

// Auto-approve level schema
export const autoApproveLevelSchema = z.enum(VALIDATION_LIMITS.AUTO_APPROVE_LEVELS, {
  errorMap: () => ({
    message: `Invalid autoApproveLevel. Must be one of: ${VALIDATION_LIMITS.AUTO_APPROVE_LEVELS.join(', ')}`,
  }),
});

// ============================================================================
// Request Body Schemas
// ============================================================================

/**
 * POST /api/agentic/execute
 */
export const executeRequestSchema = z.object({
  goal: goalSchema,
  customerId: customerIdSchema,
}).strict();

/**
 * POST /api/agentic/plan
 */
export const planRequestSchema = z.object({
  goal: goalSchema,
  customerId: customerIdSchema,
}).strict();

/**
 * POST /api/agentic/execute-plan
 */
export const executePlanRequestSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  customerId: customerIdSchema,
}).strict();

/**
 * POST /api/agentic/resume
 */
export const resumeRequestSchema = z.object({
  stateId: stateIdSchema,
  approved: z.boolean({
    required_error: 'approved is required',
    invalid_type_error: 'approved must be a boolean',
  }),
  reason: z.string().max(500).optional(),
}).strict();

/**
 * POST /api/agentic/specialist/:agentId
 */
export const specialistRequestSchema = z.object({
  task: taskSchema,
  customerId: customerIdSchema,
}).strict();

/**
 * POST /api/agentic-mode/toggle
 */
export const toggleRequestSchema = z.object({
  enabled: z.boolean({
    required_error: 'enabled is required',
    invalid_type_error: 'enabled must be a boolean',
  }),
}).strict();

/**
 * POST /api/agentic-mode/preset
 */
export const presetRequestSchema = z.object({
  preset: presetSchema,
}).strict();

/**
 * PUT /api/agentic-mode/config
 */
export const configUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  maxSteps: z.number()
    .int('maxSteps must be an integer')
    .min(1, 'maxSteps must be at least 1')
    .max(100, 'maxSteps must not exceed 100')
    .optional(),
  autoApproveLevel: autoApproveLevelSchema.optional(),
  pauseOnHighRisk: z.boolean().optional(),
  notifyOnCompletion: z.boolean().optional(),
}).strict();

/**
 * PUT /api/agentic-mode/schedule
 */
export const scheduleRequestSchema = z.object({
  schedule: z.object({
    enabled: z.boolean(),
    timezone: z.string().min(1, 'Timezone is required when schedule is enabled').optional(),
    rules: z.array(z.object({
      days: z.array(z.number().min(0).max(6)),
      startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
      endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
      preset: presetSchema,
    })).optional(),
  }).refine(
    (data) => !data.enabled || (data.timezone && data.rules && data.rules.length > 0),
    { message: 'timezone and rules are required when schedule is enabled' }
  ).nullable().optional(),
}).strict();

// ============================================================================
// Validation Error Formatting
// ============================================================================

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

/**
 * Format Zod error into user-friendly error details
 */
export function formatZodError(error: ZodError): ValidationErrorDetail[] {
  return error.errors.map((err) => ({
    field: err.path.join('.') || 'body',
    message: err.message,
    code: err.code,
  }));
}

/**
 * Create validation error response
 */
function validationErrorResponse(
  res: Response,
  errors: ValidationErrorDetail[]
): void {
  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: errors,
    },
  });
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create validation middleware for a specific schema
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize the request body first
      const sanitizedBody = sanitizeObject(req.body);

      // Validate with Zod
      const result = schema.safeParse(sanitizedBody);

      if (!result.success) {
        const errors = formatZodError(result.error);
        return validationErrorResponse(res, errors);
      }

      // Replace body with validated and sanitized data
      req.body = result.data;
      next();
    } catch (error) {
      console.error('[Validation] Unexpected error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_INTERNAL_ERROR',
          message: 'An error occurred during validation',
        },
      });
    }
  };
}

/**
 * Validate URL parameters
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        const errors = formatZodError(result.error);
        return validationErrorResponse(res, errors);
      }

      req.params = result.data;
      next();
    } catch (error) {
      console.error('[Validation] Unexpected error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_INTERNAL_ERROR',
          message: 'An error occurred during validation',
        },
      });
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        const errors = formatZodError(result.error);
        return validationErrorResponse(res, errors);
      }

      req.query = result.data;
      next();
    } catch (error) {
      console.error('[Validation] Unexpected error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_INTERNAL_ERROR',
          message: 'An error occurred during validation',
        },
      });
    }
  };
}

// ============================================================================
// Pre-built Validation Middleware
// ============================================================================

export const validateExecuteRequest = validateBody(executeRequestSchema);
export const validatePlanRequest = validateBody(planRequestSchema);
export const validateExecutePlanRequest = validateBody(executePlanRequestSchema);
export const validateResumeRequest = validateBody(resumeRequestSchema);
export const validateSpecialistRequest = validateBody(specialistRequestSchema);
export const validateToggleRequest = validateBody(toggleRequestSchema);
export const validatePresetRequest = validateBody(presetRequestSchema);
export const validateConfigUpdate = validateBody(configUpdateSchema);
export const validateScheduleRequest = validateBody(scheduleRequestSchema);

// Param validators
export const validateAgentIdParam = validateParams(z.object({
  agentId: agentIdSchema,
}));

export const validateCustomerIdParam = validateParams(z.object({
  customerId: z.string().uuid('Invalid customer ID format'),
}));

export const validateStateIdParam = validateParams(z.object({
  stateId: stateIdSchema,
}));

// ============================================================================
// Type Exports
// ============================================================================

export type ExecuteRequest = z.infer<typeof executeRequestSchema>;
export type PlanRequest = z.infer<typeof planRequestSchema>;
export type ExecutePlanRequest = z.infer<typeof executePlanRequestSchema>;
export type ResumeRequest = z.infer<typeof resumeRequestSchema>;
export type SpecialistRequest = z.infer<typeof specialistRequestSchema>;
export type ToggleRequest = z.infer<typeof toggleRequestSchema>;
export type PresetRequest = z.infer<typeof presetRequestSchema>;
export type ConfigUpdate = z.infer<typeof configUpdateSchema>;
export type ScheduleRequest = z.infer<typeof scheduleRequestSchema>;
