/**
 * Intelligence Routes (PRD-056: Tell Me About [Account], PRD-059: Renewal Pipeline Forecast, PRD-064: Product Adoption Dashboard)
 *
 * API endpoints for account intelligence and briefings.
 *
 * Endpoints:
 * - GET  /api/intelligence/account-briefing/:customerId - Get briefing by ID
 * - POST /api/intelligence/account-briefing/search     - Search and generate briefing by name
 * - GET  /api/intelligence/renewal-forecast            - Get renewal pipeline forecast (PRD-059)
 * - GET  /api/intelligence/renewal-forecast/:customerId - Get single customer renewal forecast
 * - GET  /api/intelligence/adoption/:customerId        - Get product adoption dashboard (PRD-064)
 */

import { Router, Request, Response } from 'express';
import { accountBriefingService } from '../services/accountBriefing.js';
import { productAdoptionService } from '../services/productAdoption.js';
import { renewalForecastService } from '../services/renewalForecast.js';
import { anomalyDetectionService, AnomalyType, AnomalySeverity } from '../services/analytics/index.js';

const router = Router();

/**
 * GET /api/intelligence/account-briefing/:customerId
 *
 * Generate comprehensive account briefing for a specific customer ID.
 *
 * Query Parameters:
 * - focusArea (optional): 'health', 'renewal', 'stakeholders', 'usage'
 * - timePeriod (optional): 'last 30 days', 'this quarter', etc.
 */
router.get('/account-briefing/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const { focusArea, timePeriod } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    const briefing = await accountBriefingService.generateBriefing(
      customerId,
      focusArea as string | undefined,
      timePeriod as string | undefined
    );

    if (!briefing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: `Could not find an account with ID '${customerId}'`
        }
      });
    }

    const responseTime = Date.now() - startTime;

    // Log performance for monitoring
    console.log(`[Intelligence] Account briefing generated for ${briefing.accountName} in ${responseTime}ms`);

    // Warn if over 5 second target
    if (responseTime > 5000) {
      console.warn(`[Intelligence] Briefing generation exceeded 5s target: ${responseTime}ms`);
    }

    return res.json({
      success: true,
      data: briefing,
      meta: {
        generatedAt: briefing.generatedAt,
        responseTimeMs: responseTime,
        dataCompleteness: briefing.dataCompleteness
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error generating account briefing:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate account briefing'
      }
    });
  }
});

/**
 * POST /api/intelligence/account-briefing/search
 *
 * Search for an account by name and generate briefing.
 * Supports fuzzy matching for partial names and typos.
 *
 * Request Body:
 * - accountName (required): The customer/company name to search for
 * - focusArea (optional): 'health', 'renewal', 'stakeholders', 'usage'
 * - timePeriod (optional): 'last 30 days', 'this quarter', etc.
 */
router.post('/account-briefing/search', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { accountName, focusArea, timePeriod } = req.body;

    if (!accountName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACCOUNT_NAME',
          message: 'Account name is required in the request body'
        }
      });
    }

    // Search for matching accounts
    const searchResults = await accountBriefingService.searchAccounts(accountName);

    if (searchResults.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: `I couldn't find an account matching '${accountName}'.`,
          suggestions: []
        }
      });
    }

    // If multiple good matches, return suggestions
    const goodMatches = searchResults.filter(r => r.matchScore >= 70);

    if (goodMatches.length > 1) {
      return res.status(300).json({
        success: false,
        error: {
          code: 'MULTIPLE_MATCHES',
          message: `I found multiple accounts matching '${accountName}'. Which one did you mean?`,
          suggestions: goodMatches.map(m => ({
            id: m.id,
            name: m.name,
            arr: m.arr,
            healthScore: m.healthScore,
            stage: m.stage
          }))
        }
      });
    }

    // Use best match
    const bestMatch = searchResults[0];

    // If match score is low, return with suggestion
    if (bestMatch.matchScore < 50) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: `I couldn't find an account matching '${accountName}'. Did you mean ${bestMatch.name}?`,
          suggestions: [
            {
              id: bestMatch.id,
              name: bestMatch.name,
              arr: bestMatch.arr,
              healthScore: bestMatch.healthScore,
              stage: bestMatch.stage
            }
          ]
        }
      });
    }

    // Generate briefing for best match
    const briefing = await accountBriefingService.generateBriefing(
      bestMatch.id,
      focusArea,
      timePeriod
    );

    if (!briefing) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'BRIEFING_GENERATION_FAILED',
          message: 'Failed to generate account briefing'
        }
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(`[Intelligence] Account briefing generated for ${briefing.accountName} in ${responseTime}ms (search)`);

    return res.json({
      success: true,
      data: briefing,
      meta: {
        searchedFor: accountName,
        matchedAccount: bestMatch.name,
        matchScore: bestMatch.matchScore,
        generatedAt: briefing.generatedAt,
        responseTimeMs: responseTime,
        dataCompleteness: briefing.dataCompleteness
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error in account briefing search:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process account briefing request'
      }
    });
  }
});

/**
 * GET /api/intelligence/accounts/suggestions
 *
 * Get account name suggestions for autocomplete.
 *
 * Query Parameters:
 * - q: Search query (minimum 2 characters)
 * - limit: Maximum results (default 5)
 */
router.get('/accounts/suggestions', async (req: Request, res: Response) => {
  try {
    const { q, limit = '5' } = req.query;

    if (!q || (q as string).length < 2) {
      return res.json({
        success: true,
        data: {
          suggestions: []
        }
      });
    }

    const results = await accountBriefingService.searchAccounts(q as string);

    return res.json({
      success: true,
      data: {
        suggestions: results.slice(0, parseInt(limit as string)).map(r => ({
          id: r.id,
          name: r.name,
          arr: r.arr,
          healthScore: r.healthScore,
          stage: r.stage
        }))
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error fetching account suggestions:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch account suggestions'
      }
    });
  }
});

/**
 * POST /api/intelligence/parse-command
 *
 * Parse a natural language command to extract account name and focus area.
 * Supports: "Tell me about [Account]", "Brief me on [Account]",
 *           "What's the story with [Account]?", etc.
 */
router.post('/parse-command', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_COMMAND',
          message: 'Command text is required'
        }
      });
    }

    // Parse the command for account name and focus area
    const parsed = parseNaturalLanguageCommand(command);

    if (!parsed.accountName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'Could not parse account name from command'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        accountName: parsed.accountName,
        focusArea: parsed.focusArea,
        timePeriod: parsed.timePeriod,
        originalCommand: command
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error parsing command:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to parse command'
      }
    });
  }
});

/**
 * Parse natural language commands for account briefing
 */
function parseNaturalLanguageCommand(command: string): {
  accountName: string | null;
  focusArea: string | null;
  timePeriod: string | null;
} {
  const result = {
    accountName: null as string | null,
    focusArea: null as string | null,
    timePeriod: null as string | null
  };

  const lowerCommand = command.toLowerCase();

  // Patterns to extract account name
  const patterns = [
    /tell me about\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i,
    /brief me on\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i,
    /what(?:'s| is) the (?:story|status|deal) with\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i,
    /give me (?:the )?rundown on\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i,
    /account (?:summary|briefing|overview) for\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i,
    /how is\s+(.+?)\s+doing/i,
    /what do we know about\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match && match[1]) {
      result.accountName = match[1].trim();
      break;
    }
  }

  // Extract focus area
  if (lowerCommand.includes('health')) {
    result.focusArea = 'health';
  } else if (lowerCommand.includes('renewal')) {
    result.focusArea = 'renewal';
  } else if (lowerCommand.includes('stakeholder')) {
    result.focusArea = 'stakeholders';
  } else if (lowerCommand.includes('usage') || lowerCommand.includes('adoption')) {
    result.focusArea = 'usage';
  }

  // Extract time period
  const timePeriodPatterns = [
    { pattern: /last (\d+) days/i, extract: (m: RegExpMatchArray) => `last ${m[1]} days` },
    { pattern: /this (week|month|quarter|year)/i, extract: (m: RegExpMatchArray) => `this ${m[1]}` },
    { pattern: /last (week|month|quarter|year)/i, extract: (m: RegExpMatchArray) => `last ${m[1]}` }
  ];

  for (const { pattern, extract } of timePeriodPatterns) {
    const match = command.match(pattern);
    if (match) {
      result.timePeriod = extract(match);
      break;
    }
  }

  return result;
}

// ============================================
// PRD-059: RENEWAL PIPELINE FORECAST
// ============================================

/**
 * GET /api/intelligence/renewal-forecast
 *
 * Generate comprehensive renewal pipeline forecast.
 *
 * Query Parameters:
 * - horizon (optional): '30d', '60d', '90d', 'quarter', 'year' (default: 90d)
 * - csmId (optional): Filter to specific CSM
 * - segment (optional): Filter by customer segment/industry
 * - risk (optional): 'all', 'at-risk', 'healthy' (default: all)
 */
router.get('/renewal-forecast', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { horizon, csmId, segment, risk } = req.query;

    const forecast = await renewalForecastService.generateForecast({
      horizon: horizon as string,
      csmId: csmId as string,
      segment: segment as string,
      riskFilter: (risk as 'all' | 'at-risk' | 'healthy') || 'all',
    });

    const responseTime = Date.now() - startTime;

    console.log(`[Intelligence] Renewal forecast generated with ${forecast.predictions.length} renewals in ${responseTime}ms`);

    // Warn if over 5 second target
    if (responseTime > 5000) {
      console.warn(`[Intelligence] Renewal forecast exceeded 5s target: ${responseTime}ms`);
    }

    return res.json({
      success: true,
      data: forecast,
      meta: {
        generatedAt: forecast.generatedAt,
        responseTimeMs: responseTime,
        renewalCount: forecast.predictions.length,
        period: forecast.period,
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error generating renewal forecast:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate renewal forecast'
      }
    });
  }
});

/**
 * POST /api/intelligence/renewal-forecast
 *
 * Generate renewal pipeline forecast with advanced filters.
 *
 * Request Body:
 * - csmId (optional): UUID of specific CSM
 * - startDate (optional): Start of date range
 * - endDate (optional): End of date range
 * - segments (optional): Array of segment/industry filters
 */
router.post('/renewal-forecast', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { csmId, startDate, endDate, segments, riskFilter } = req.body;

    // Calculate horizon from dates if provided
    let horizon = '90d';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      horizon = `${days}d`;
    }

    const forecast = await renewalForecastService.generateForecast({
      horizon,
      csmId,
      segment: segments?.[0], // For now, use first segment
      riskFilter: riskFilter || 'all',
    });

    const responseTime = Date.now() - startTime;

    console.log(`[Intelligence] Renewal forecast (POST) generated with ${forecast.predictions.length} renewals in ${responseTime}ms`);

    return res.json({
      success: true,
      data: forecast,
      meta: {
        generatedAt: forecast.generatedAt,
        responseTimeMs: responseTime,
        renewalCount: forecast.predictions.length,
        period: forecast.period,
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error generating renewal forecast (POST):', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate renewal forecast'
      }
    });
  }
});

/**
 * GET /api/intelligence/renewal-forecast/:customerId
 *
 * Get renewal forecast for a specific customer.
 */
router.get('/renewal-forecast/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    const prediction = await renewalForecastService.getCustomerForecast(customerId);

    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find renewal data for customer ID '${customerId}'`
        }
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(`[Intelligence] Customer renewal forecast generated for ${prediction.customerName} in ${responseTime}ms`);

    return res.json({
      success: true,
      data: prediction,
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: responseTime,
        riskLevel: prediction.riskLevel,
        probability: prediction.probability,
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error generating customer renewal forecast:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate customer renewal forecast'
      }
    });
  }
});

/**
 * GET /api/intelligence/renewal-forecast/export
 *
 * Export renewal forecast as CSV/Excel.
 */
router.get('/renewal-forecast/export', async (req: Request, res: Response) => {
  try {
    const { format = 'csv', horizon = '90d' } = req.query;

    const forecast = await renewalForecastService.generateForecast({
      horizon: horizon as string,
      riskFilter: 'all',
    });

    if (format === 'csv') {
      // Generate CSV
      const headers = ['Account', 'ARR', 'Renewal Date', 'Days Until', 'Probability', 'Risk Level', 'Predicted Outcome', 'Expected ARR'];
      const rows = forecast.predictions.map(p => [
        p.customerName,
        p.currentArr,
        p.renewalDate,
        p.daysUntilRenewal,
        `${p.probability}%`,
        p.riskLevel,
        p.predictedOutcome,
        p.expectedArr,
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="renewal-forecast-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    // Default to JSON
    return res.json({
      success: true,
      data: forecast,
      meta: {
        exportFormat: format,
        recordCount: forecast.predictions.length,
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error exporting renewal forecast:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to export renewal forecast'
      }
    });
  }
});

// ============================================
// PRD-064: PRODUCT ADOPTION DASHBOARD
// ============================================

/**
 * GET /api/intelligence/adoption/:customerId
 *
 * Generate comprehensive product adoption dashboard for a customer.
 * (PRD-064: Product Adoption Dashboard)
 *
 * Query Parameters:
 * - period (optional): '7d', '30d', '90d', 'all' (default: 30d)
 * - comparison (optional): 'peers', 'segment', 'all_customers' (default: peers)
 */
router.get('/adoption/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const { period = '30d', comparison = 'peers' } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    // Validate period
    const validPeriods = ['7d', '30d', '90d', 'all'];
    if (!validPeriods.includes(period as string)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PERIOD',
          message: `Period must be one of: ${validPeriods.join(', ')}`
        }
      });
    }

    // Validate comparison
    const validComparisons = ['peers', 'segment', 'all_customers'];
    if (!validComparisons.includes(comparison as string)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COMPARISON',
          message: `Comparison must be one of: ${validComparisons.join(', ')}`
        }
      });
    }

    const dashboard = await productAdoptionService.generateDashboard(
      customerId,
      period as '7d' | '30d' | '90d' | 'all',
      comparison as 'peers' | 'segment' | 'all_customers'
    );

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`
        }
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(`[Intelligence] Adoption dashboard generated for ${dashboard.customerName} in ${responseTime}ms`);

    return res.json({
      success: true,
      data: dashboard,
      meta: {
        generatedAt: dashboard.generatedAt,
        responseTimeMs: responseTime,
        period: dashboard.period,
        adoptionScore: dashboard.adoptionScore
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error generating adoption dashboard:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate adoption dashboard'
      }
    });
  }
});

/**
 * GET /api/intelligence/adoption/:customerId/export
 *
 * Export product adoption report as PDF (future implementation).
 */
router.get('/adoption/:customerId/export', async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const { format = 'pdf' } = req.query;

  // For now, return a placeholder indicating this feature is planned
  return res.json({
    success: true,
    data: {
      message: 'Report export functionality coming soon',
      customerId,
      format,
      estimatedDelivery: 'Q2 2026'
    }
  });
});

/**
 * POST /api/intelligence/adoption/:customerId/actions/:actionType
 *
 * Execute quick actions from the adoption dashboard.
 * Supported actions: schedule_training, send_guide, export_list, create_campaign, generate_report
 */
router.post('/adoption/:customerId/actions/:actionType', async (req: Request, res: Response) => {
  try {
    const { customerId, actionType } = req.params;
    const { featureId, userIds, templateId } = req.body;

    const supportedActions = ['schedule_training', 'send_guide', 'export_list', 'create_campaign', 'generate_report', 'share_link'];

    if (!supportedActions.includes(actionType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: `Action must be one of: ${supportedActions.join(', ')}`
        }
      });
    }

    // Handle different action types
    let result: any = { actionType, status: 'initiated' };

    switch (actionType) {
      case 'schedule_training':
        result = {
          actionType,
          status: 'initiated',
          message: 'Training session scheduling initiated',
          nextSteps: ['Select date/time', 'Invite participants', 'Confirm with customer'],
          data: { featureId, customerId }
        };
        break;

      case 'send_guide':
        result = {
          actionType,
          status: 'initiated',
          message: 'Guide delivery initiated',
          nextSteps: ['Customize guide', 'Select recipients', 'Send email'],
          data: { featureId, templateId: templateId || 'default' }
        };
        break;

      case 'export_list':
        result = {
          actionType,
          status: 'completed',
          message: 'User list exported successfully',
          data: {
            exportUrl: `/api/customers/${customerId}/users/export?filter=dormant`,
            userCount: userIds?.length || 0
          }
        };
        break;

      case 'create_campaign':
        result = {
          actionType,
          status: 'initiated',
          message: 'Re-engagement campaign created',
          nextSteps: ['Customize messaging', 'Set schedule', 'Launch campaign'],
          data: { customerId, targetUsers: userIds?.length || 0 }
        };
        break;

      case 'generate_report':
        result = {
          actionType,
          status: 'initiated',
          message: 'Report generation queued',
          data: { customerId, estimatedTime: '2-3 minutes' }
        };
        break;

      case 'share_link':
        result = {
          actionType,
          status: 'completed',
          message: 'Sharing links generated',
          data: {
            featureId,
            links: {
              ios: 'https://apps.apple.com/app/example',
              android: 'https://play.google.com/store/apps/details?id=example',
              web: 'https://app.example.com/mobile'
            }
          }
        };
        break;
    }

    console.log(`[Intelligence] Adoption action ${actionType} executed for customer ${customerId}`);

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Intelligence] Error executing adoption action:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to execute action'
      }
    });
  }
});

// ============================================
// PRD-084: USAGE ANOMALY DETECTION
// ============================================

/**
 * GET /api/intelligence/anomalies/:customerId
 *
 * Get detected usage anomalies for a specific customer.
 * (PRD-084: Usage Anomaly Detection)
 *
 * Query Parameters:
 * - includeDismissed (optional): Include dismissed anomalies (default: false)
 * - type (optional): Filter by anomaly type (drop, spike, pattern_change, feature_abandonment)
 * - severity (optional): Filter by severity (critical, warning, info)
 * - limit (optional): Maximum results (default: 50)
 */
router.get('/anomalies/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const {
      includeDismissed = 'false',
      type,
      severity,
      limit = '50',
    } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    const anomalies = await anomalyDetectionService.getAnomaliesForCustomer(customerId, {
      includesDismissed: includeDismissed === 'true',
      anomalyType: type as AnomalyType | undefined,
      severity: severity as AnomalySeverity | undefined,
      limit: parseInt(limit as string),
    });

    const responseTime = Date.now() - startTime;

    console.log(`[Intelligence] Retrieved ${anomalies.length} anomalies for ${customerId} in ${responseTime}ms`);

    return res.json({
      success: true,
      data: {
        customerId,
        anomalies,
        count: anomalies.length,
      },
      meta: {
        responseTimeMs: responseTime,
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error fetching anomalies:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch usage anomalies'
      }
    });
  }
});

/**
 * POST /api/intelligence/anomalies/scan
 *
 * Trigger anomaly scan for all customers or a specific customer.
 * (PRD-084: Usage Anomaly Detection)
 *
 * Request Body:
 * - customerId (optional): Scan specific customer only
 * - config (optional): Detection configuration overrides
 */
router.post('/anomalies/scan', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId, config } = req.body;

    if (customerId) {
      // Scan single customer
      const result = await anomalyDetectionService.detectAnomaliesForCustomer(customerId, config);

      const responseTime = Date.now() - startTime;

      console.log(`[Intelligence] Anomaly scan for ${customerId}: ${result.anomalies.length} anomalies in ${responseTime}ms`);

      return res.json({
        success: true,
        data: {
          customerId,
          customerName: result.customerName,
          anomalies: result.anomalies,
          skipped: result.skipped,
          skipReason: result.skipReason,
        },
        meta: {
          responseTimeMs: responseTime,
          scannedAt: new Date().toISOString(),
        }
      });
    }

    // Scan all customers
    const summary = await anomalyDetectionService.scanAllCustomers(config);

    const responseTime = Date.now() - startTime;

    console.log(`[Intelligence] Full anomaly scan: ${summary.customersScanned} customers, ${summary.totalAnomalies} anomalies in ${responseTime}ms`);

    // Warn if over 30 second target for full scan
    if (responseTime > 30000) {
      console.warn(`[Intelligence] Full scan exceeded 30s target: ${responseTime}ms`);
    }

    return res.json({
      success: true,
      data: {
        summary: {
          scannedAt: summary.scannedAt,
          customersScanned: summary.customersScanned,
          customersWithAnomalies: summary.customersWithAnomalies,
          totalAnomalies: summary.totalAnomalies,
          byType: summary.byType,
          bySeverity: summary.bySeverity,
        },
        // Only include customers with anomalies in response
        results: summary.results.filter(r => r.anomalies.length > 0),
      },
      meta: {
        responseTimeMs: responseTime,
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error running anomaly scan:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to run anomaly scan'
      }
    });
  }
});

/**
 * PUT /api/intelligence/anomalies/:anomalyId/dismiss
 *
 * Dismiss an anomaly as a false positive.
 * (PRD-084: Usage Anomaly Detection)
 */
router.put('/anomalies/:anomalyId/dismiss', async (req: Request, res: Response) => {
  try {
    const { anomalyId } = req.params;
    const userId = (req as any).userId || 'system';

    if (!anomalyId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ANOMALY_ID',
          message: 'Anomaly ID is required'
        }
      });
    }

    const dismissed = await anomalyDetectionService.dismissAnomaly(anomalyId, userId);

    if (!dismissed) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ANOMALY_NOT_FOUND',
          message: `Could not find anomaly with ID '${anomalyId}'`
        }
      });
    }

    console.log(`[Intelligence] Anomaly ${anomalyId} dismissed by ${userId}`);

    return res.json({
      success: true,
      data: dismissed
    });
  } catch (error) {
    console.error('[Intelligence] Error dismissing anomaly:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to dismiss anomaly'
      }
    });
  }
});

/**
 * GET /api/intelligence/anomalies/portfolio
 *
 * Get anomaly summary for portfolio view.
 * Returns aggregated counts and primary anomalies by customer.
 * (PRD-084: Usage Anomaly Detection)
 */
router.get('/anomalies/portfolio', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const summary = await anomalyDetectionService.getPortfolioAnomalySummary();

    const responseTime = Date.now() - startTime;

    console.log(`[Intelligence] Portfolio anomaly summary: ${summary.accounts.length} accounts in ${responseTime}ms`);

    return res.json({
      success: true,
      data: summary,
      meta: {
        responseTimeMs: responseTime,
        generatedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('[Intelligence] Error fetching portfolio anomaly summary:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch portfolio anomaly summary'
      }
    });
  }
});

export default router;
