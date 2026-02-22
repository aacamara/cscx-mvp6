/**
 * Voice Commands API Routes (PRD-264)
 *
 * REST API endpoints for voice command processing and settings.
 */

import { Router, Request, Response } from 'express';
import { voiceCommandService } from '../services/mobile/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Command Processing
// ============================================

/**
 * POST /api/voice/process
 *
 * Process a voice transcript and return the matched command result.
 *
 * Request body:
 * - transcript: string - The voice input text
 * - executeIfMatch: boolean - Whether to execute the command if matched (default: true)
 *
 * Response:
 * - matched: boolean - Whether a command was matched
 * - command: object | null - The matched command details
 * - result: object | null - The execution result (if executeIfMatch is true)
 * - suggestions: array - Alternative interpretations if no exact match
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { transcript, executeIfMatch = true } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid transcript',
        message: 'A transcript string is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    // Parse the transcript to find a matching command
    const match = await voiceCommandService.parseCommand(transcript);

    if (!match) {
      // No match found - return suggestions
      const allCommands = voiceCommandService.getCommands();
      const suggestions = allCommands
        .filter(cmd => {
          const patternWords = cmd.pattern.replace(/\*/g, '').toLowerCase().split(/\s+/);
          const transcriptWords = transcript.toLowerCase().split(/\s+/);
          return patternWords.some(pw => transcriptWords.some(tw => tw.includes(pw)));
        })
        .slice(0, 3)
        .map(cmd => ({
          pattern: cmd.pattern,
          description: cmd.description,
          example: cmd.pattern.replace('*', 'Acme Corp'),
        }));

      return res.json({
        matched: false,
        command: null,
        result: null,
        suggestions,
        message: "I didn't understand that command. Here are some similar commands you can try.",
      });
    }

    // Execute the command if requested
    let result = null;
    if (executeIfMatch) {
      result = await voiceCommandService.executeCommand(match, userId);
    }

    res.json({
      matched: true,
      command: {
        id: match.command.id,
        action: match.command.action,
        description: match.command.description,
        category: match.command.category,
        requiresConfirmation: match.command.requiresConfirmation,
      },
      args: match.args,
      confidence: match.confidence,
      result,
    });
  } catch (error) {
    console.error('Voice command processing error:', error);
    res.status(500).json({
      error: 'Processing failed',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/voice/confirm
 *
 * Confirm and execute a command that requires confirmation.
 *
 * Request body:
 * - commandId: string - The command ID to confirm
 * - args: string[] - The command arguments
 *
 * Response:
 * - success: boolean
 * - result: object - The execution result
 */
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { commandId, args } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!commandId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'commandId and x-user-id header are required',
      });
    }

    const commands = voiceCommandService.getCommands();
    const command = commands.find(c => c.id === commandId);

    if (!command) {
      return res.status(404).json({
        error: 'Command not found',
        message: `No command found with ID: ${commandId}`,
      });
    }

    // Execute the confirmed command
    const result = await voiceCommandService.executeCommand(
      {
        command,
        args: args || [],
        confidence: 100,
      },
      userId
    );

    res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    console.error('Voice command confirmation error:', error);
    res.status(500).json({
      error: 'Confirmation failed',
      message: (error as Error).message,
    });
  }
});

// ============================================
// Command Discovery
// ============================================

/**
 * GET /api/voice/commands
 *
 * Get all available voice commands.
 *
 * Query params:
 * - category: string - Filter by category (navigation, information, action, task, dictation)
 *
 * Response:
 * - commands: array - List of available commands
 */
router.get('/commands', (req: Request, res: Response) => {
  try {
    const { category } = req.query;

    let commands = voiceCommandService.getCommands();

    if (category && typeof category === 'string') {
      const validCategories = ['navigation', 'information', 'action', 'task', 'dictation'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: 'Invalid category',
          message: `Category must be one of: ${validCategories.join(', ')}`,
        });
      }
      commands = voiceCommandService.getCommandsByCategory(
        category as 'navigation' | 'information' | 'action' | 'task' | 'dictation'
      );
    }

    res.json({
      commands: commands.map(cmd => ({
        id: cmd.id,
        pattern: cmd.pattern,
        action: cmd.action,
        description: cmd.description,
        category: cmd.category,
        requiresConfirmation: cmd.requiresConfirmation,
        example: cmd.pattern.replace('*', 'Acme Corp'),
      })),
      count: commands.length,
    });
  } catch (error) {
    console.error('Get commands error:', error);
    res.status(500).json({
      error: 'Failed to get commands',
      message: (error as Error).message,
    });
  }
});

// ============================================
// Settings Management
// ============================================

/**
 * GET /api/voice/settings
 *
 * Get voice settings for the current user.
 *
 * Response:
 * - settings: object - User's voice settings
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const settings = await voiceCommandService.getSettings(userId);

    res.json({
      settings,
    });
  } catch (error) {
    console.error('Get voice settings error:', error);
    res.status(500).json({
      error: 'Failed to get settings',
      message: (error as Error).message,
    });
  }
});

/**
 * PUT /api/voice/settings
 *
 * Update voice settings for the current user.
 *
 * Request body (all optional):
 * - voiceEnabled: boolean
 * - continuousListening: boolean
 * - speechRate: number (0.5 - 2.0)
 * - voiceResponseEnabled: boolean
 * - summaryMode: boolean
 * - confirmDestructiveActions: boolean
 * - language: string
 *
 * Response:
 * - settings: object - Updated settings
 */
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const {
      voiceEnabled,
      continuousListening,
      speechRate,
      voiceResponseEnabled,
      summaryMode,
      confirmDestructiveActions,
      language,
    } = req.body;

    // Validate speech rate
    if (speechRate !== undefined) {
      if (typeof speechRate !== 'number' || speechRate < 0.5 || speechRate > 2.0) {
        return res.status(400).json({
          error: 'Invalid speech rate',
          message: 'Speech rate must be a number between 0.5 and 2.0',
        });
      }
    }

    const settings = await voiceCommandService.updateSettings(userId, {
      voiceEnabled,
      continuousListening,
      speechRate,
      voiceResponseEnabled,
      summaryMode,
      confirmDestructiveActions,
      language,
    });

    res.json({
      settings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Update voice settings error:', error);
    res.status(500).json({
      error: 'Failed to update settings',
      message: (error as Error).message,
    });
  }
});

// ============================================
// Customer Search
// ============================================

/**
 * GET /api/voice/search/customers
 *
 * Search for customers by name (for voice command autocomplete).
 *
 * Query params:
 * - q: string - Search query
 *
 * Response:
 * - customers: array - Matching customers
 */
router.get('/search/customers', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    const userId = req.headers['x-user-id'] as string;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        error: 'Missing search query',
        message: 'Query parameter "q" is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const customer = await voiceCommandService.findCustomerByName(q, userId);

    if (customer) {
      res.json({
        customers: [customer],
        count: 1,
      });
    } else {
      res.json({
        customers: [],
        count: 0,
      });
    }
  } catch (error) {
    console.error('Customer search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: (error as Error).message,
    });
  }
});

export default router;
