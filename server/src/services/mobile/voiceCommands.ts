/**
 * Voice Command Service (PRD-264)
 *
 * Backend service for processing voice commands, parsing natural language,
 * and executing customer success actions.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// ============================================
// Types
// ============================================

export interface VoiceCommand {
  id: string;
  pattern: string;
  action: string;
  description: string;
  requiresConfirmation: boolean;
  category: 'navigation' | 'information' | 'action' | 'task' | 'dictation';
}

export interface CommandMatch {
  command: VoiceCommand;
  args: string[];
  confidence: number;
}

export interface VoiceCommandResult {
  success: boolean;
  action: string;
  response: string;
  data?: any;
  requiresConfirmation?: boolean;
  navigationTarget?: string;
  error?: string;
}

export interface VoiceSettings {
  userId: string;
  voiceEnabled: boolean;
  continuousListening: boolean;
  speechRate: number;
  voiceResponseEnabled: boolean;
  summaryMode: boolean;
  confirmDestructiveActions: boolean;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerMatch {
  id: string;
  name: string;
  confidence: number;
}

// ============================================
// Default Commands Registry
// ============================================

const DEFAULT_COMMANDS: VoiceCommand[] = [
  // Navigation commands
  {
    id: 'nav-customer',
    pattern: 'go to *',
    action: 'navigate_customer',
    description: 'Navigate to a specific customer',
    requiresConfirmation: false,
    category: 'navigation',
  },
  {
    id: 'nav-tasks',
    pattern: 'show my tasks',
    action: 'navigate_tasks',
    description: 'Navigate to tasks view',
    requiresConfirmation: false,
    category: 'navigation',
  },
  {
    id: 'nav-home',
    pattern: 'go home',
    action: 'navigate_home',
    description: 'Navigate to home/dashboard',
    requiresConfirmation: false,
    category: 'navigation',
  },
  {
    id: 'nav-back',
    pattern: 'go back',
    action: 'navigate_back',
    description: 'Go back to previous page',
    requiresConfirmation: false,
    category: 'navigation',
  },
  {
    id: 'nav-notifications',
    pattern: 'read notifications',
    action: 'read_notifications',
    description: 'Read pending notifications',
    requiresConfirmation: false,
    category: 'navigation',
  },

  // Information commands
  {
    id: 'info-customer',
    pattern: 'tell me about *',
    action: 'get_customer_info',
    description: 'Get summary about a customer',
    requiresConfirmation: false,
    category: 'information',
  },
  {
    id: 'info-health',
    pattern: 'what is the health score for *',
    action: 'get_health_score',
    description: 'Get health score for a customer',
    requiresConfirmation: false,
    category: 'information',
  },
  {
    id: 'info-renewal',
    pattern: 'when is * renewal',
    action: 'get_renewal_date',
    description: 'Get renewal date for a customer',
    requiresConfirmation: false,
    category: 'information',
  },
  {
    id: 'info-churn-risk',
    pattern: 'show churn risk for *',
    action: 'get_churn_risk',
    description: 'Get churn risk analysis for a customer',
    requiresConfirmation: false,
    category: 'information',
  },

  // Action commands
  {
    id: 'action-email',
    pattern: 'draft email to *',
    action: 'draft_email',
    description: 'Start drafting an email to customer',
    requiresConfirmation: false,
    category: 'action',
  },
  {
    id: 'action-send-email',
    pattern: 'send email to *',
    action: 'send_email',
    description: 'Send email to customer (requires confirmation)',
    requiresConfirmation: true,
    category: 'action',
  },
  {
    id: 'action-meeting',
    pattern: 'schedule meeting with *',
    action: 'schedule_meeting',
    description: 'Schedule a meeting with customer',
    requiresConfirmation: true,
    category: 'action',
  },
  {
    id: 'action-note',
    pattern: 'add note for *',
    action: 'add_note',
    description: 'Add a note for a customer',
    requiresConfirmation: false,
    category: 'action',
  },

  // Task commands
  {
    id: 'task-create',
    pattern: 'create task *',
    action: 'create_task',
    description: 'Create a new task',
    requiresConfirmation: false,
    category: 'task',
  },
  {
    id: 'task-complete',
    pattern: 'complete task *',
    action: 'complete_task',
    description: 'Mark a task as complete',
    requiresConfirmation: true,
    category: 'task',
  },
  {
    id: 'task-list',
    pattern: 'list tasks for *',
    action: 'list_tasks',
    description: 'List tasks for a customer',
    requiresConfirmation: false,
    category: 'task',
  },

  // Dictation commands (handled specially)
  {
    id: 'dictation-start',
    pattern: 'start dictation',
    action: 'start_dictation',
    description: 'Start dictation mode',
    requiresConfirmation: false,
    category: 'dictation',
  },
  {
    id: 'dictation-stop',
    pattern: 'stop dictation',
    action: 'stop_dictation',
    description: 'Stop dictation mode',
    requiresConfirmation: false,
    category: 'dictation',
  },
];

// ============================================
// Voice Command Service Class
// ============================================

export class VoiceCommandService {
  private supabase: SupabaseClient | null = null;
  private commands: Map<string, VoiceCommand> = new Map();

  constructor() {
    // Initialize Supabase client
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }

    // Register default commands
    DEFAULT_COMMANDS.forEach(cmd => {
      this.commands.set(cmd.id, cmd);
    });
  }

  // ============================================
  // Command Processing
  // ============================================

  /**
   * Parse and match a voice transcript to a command
   */
  async parseCommand(transcript: string): Promise<CommandMatch | null> {
    const normalized = transcript.toLowerCase().trim();

    for (const [_, command] of this.commands) {
      const match = this.matchPattern(command.pattern, normalized);
      if (match) {
        return {
          command,
          args: match.args,
          confidence: match.confidence,
        };
      }
    }

    return null;
  }

  /**
   * Match a pattern against input text
   * Patterns use * as wildcard for variable parts
   */
  private matchPattern(
    pattern: string,
    input: string
  ): { args: string[]; confidence: number } | null {
    // Convert pattern to regex
    // * captures any text (greedy)
    const regexPattern = '^' + pattern.replace(/\*/g, '(.+?)') + '$';
    const regex = new RegExp(regexPattern, 'i');
    const match = input.match(regex);

    if (match) {
      const args = match.slice(1).map(arg => arg.trim());
      // Calculate confidence based on how well the non-wildcard parts match
      const nonWildcardParts = pattern.split('*').filter(p => p.trim());
      const matchedParts = nonWildcardParts.filter(p =>
        input.toLowerCase().includes(p.toLowerCase())
      );
      const confidence = matchedParts.length / Math.max(nonWildcardParts.length, 1);

      return { args, confidence: confidence * 100 };
    }

    // Try fuzzy matching for near-matches
    return this.fuzzyMatch(pattern, input);
  }

  /**
   * Fuzzy matching for commands that are close but not exact
   */
  private fuzzyMatch(
    pattern: string,
    input: string
  ): { args: string[]; confidence: number } | null {
    const patternWords = pattern.replace(/\*/g, '').toLowerCase().split(/\s+/).filter(w => w);
    const inputWords = input.toLowerCase().split(/\s+/);

    let matchedWords = 0;
    for (const pWord of patternWords) {
      if (inputWords.some(iWord => this.levenshteinDistance(pWord, iWord) <= 2)) {
        matchedWords++;
      }
    }

    const confidence = (matchedWords / patternWords.length) * 100;

    // Only return fuzzy matches above 60% confidence
    if (confidence >= 60) {
      // Try to extract args from remaining words
      const args = inputWords
        .filter(w => !patternWords.includes(w))
        .join(' ');

      return {
        args: args ? [args] : [],
        confidence,
      };
    }

    return null;
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Execute a parsed command
   */
  async executeCommand(
    match: CommandMatch,
    userId: string
  ): Promise<VoiceCommandResult> {
    const { command, args } = match;

    try {
      switch (command.action) {
        // Navigation commands
        case 'navigate_customer': {
          const customerMatch = await this.findCustomerByName(args[0], userId);
          if (customerMatch) {
            return {
              success: true,
              action: command.action,
              response: `Opening ${customerMatch.name}`,
              navigationTarget: `/customers/${customerMatch.id}`,
              data: customerMatch,
            };
          }
          return {
            success: false,
            action: command.action,
            response: `Could not find customer "${args[0]}"`,
            error: 'Customer not found',
          };
        }

        case 'navigate_tasks':
          return {
            success: true,
            action: command.action,
            response: 'Opening your tasks',
            navigationTarget: '/tasks',
          };

        case 'navigate_home':
          return {
            success: true,
            action: command.action,
            response: 'Going to home',
            navigationTarget: '/',
          };

        case 'navigate_back':
          return {
            success: true,
            action: command.action,
            response: 'Going back',
            navigationTarget: 'back',
          };

        case 'read_notifications':
          return {
            success: true,
            action: command.action,
            response: 'Opening notifications',
            navigationTarget: '/notifications',
          };

        // Information commands
        case 'get_customer_info': {
          const summary = await this.getCustomerSummary(args[0], userId);
          return {
            success: true,
            action: command.action,
            response: summary.response,
            data: summary.data,
          };
        }

        case 'get_health_score': {
          const health = await this.getHealthScore(args[0], userId);
          return {
            success: true,
            action: command.action,
            response: health.response,
            data: health.data,
          };
        }

        case 'get_renewal_date': {
          const renewal = await this.getRenewalInfo(args[0], userId);
          return {
            success: true,
            action: command.action,
            response: renewal.response,
            data: renewal.data,
          };
        }

        case 'get_churn_risk': {
          const risk = await this.getChurnRisk(args[0], userId);
          return {
            success: true,
            action: command.action,
            response: risk.response,
            data: risk.data,
          };
        }

        // Action commands
        case 'draft_email': {
          const customer = await this.findCustomerByName(args[0], userId);
          if (customer) {
            return {
              success: true,
              action: command.action,
              response: `Starting email draft for ${customer.name}`,
              navigationTarget: `/customers/${customer.id}/email/new`,
              data: customer,
            };
          }
          return {
            success: false,
            action: command.action,
            response: `Could not find customer "${args[0]}"`,
            error: 'Customer not found',
          };
        }

        case 'send_email':
        case 'schedule_meeting': {
          const customer = await this.findCustomerByName(args[0], userId);
          if (customer) {
            return {
              success: true,
              action: command.action,
              response: `Are you sure you want to ${command.action.replace('_', ' ')} with ${customer.name}?`,
              requiresConfirmation: true,
              data: customer,
            };
          }
          return {
            success: false,
            action: command.action,
            response: `Could not find customer "${args[0]}"`,
            error: 'Customer not found',
          };
        }

        case 'add_note': {
          const customer = await this.findCustomerByName(args[0], userId);
          if (customer) {
            return {
              success: true,
              action: command.action,
              response: `Ready to add note for ${customer.name}. What would you like to note?`,
              data: customer,
            };
          }
          return {
            success: false,
            action: command.action,
            response: `Could not find customer "${args[0]}"`,
            error: 'Customer not found',
          };
        }

        // Task commands
        case 'create_task':
          return {
            success: true,
            action: command.action,
            response: `Creating task: ${args[0]}`,
            data: { title: args[0] },
          };

        case 'complete_task':
          return {
            success: true,
            action: command.action,
            response: `Are you sure you want to complete task: ${args[0]}?`,
            requiresConfirmation: true,
            data: { title: args[0] },
          };

        case 'list_tasks': {
          const tasks = await this.getCustomerTasks(args[0], userId);
          return {
            success: true,
            action: command.action,
            response: tasks.response,
            data: tasks.data,
          };
        }

        // Dictation commands
        case 'start_dictation':
          return {
            success: true,
            action: command.action,
            response: 'Dictation mode started. Speak your text.',
          };

        case 'stop_dictation':
          return {
            success: true,
            action: command.action,
            response: 'Dictation mode stopped.',
          };

        default:
          return {
            success: false,
            action: command.action,
            response: 'Unknown command',
            error: 'Command handler not implemented',
          };
      }
    } catch (error) {
      console.error('Voice command execution error:', error);
      return {
        success: false,
        action: command.action,
        response: 'Sorry, I encountered an error processing that command.',
        error: (error as Error).message,
      };
    }
  }

  // ============================================
  // Customer Search
  // ============================================

  /**
   * Find a customer by name (fuzzy search)
   */
  async findCustomerByName(
    name: string,
    userId: string
  ): Promise<CustomerMatch | null> {
    if (!this.supabase) {
      // Return mock data for development
      return {
        id: 'mock-customer-id',
        name: name,
        confidence: 100,
      };
    }

    try {
      // Search for customer by name (case-insensitive)
      const { data: customers, error } = await this.supabase
        .from('customers')
        .select('id, name')
        .ilike('name', `%${name}%`)
        .limit(5);

      if (error || !customers || customers.length === 0) {
        return null;
      }

      // Find best match using string similarity
      let bestMatch: CustomerMatch | null = null;
      let highestConfidence = 0;

      for (const customer of customers) {
        const confidence = this.calculateStringMatch(name.toLowerCase(), customer.name.toLowerCase());
        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          bestMatch = {
            id: customer.id,
            name: customer.name,
            confidence,
          };
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Customer search error:', error);
      return null;
    }
  }

  /**
   * Calculate string match percentage
   */
  private calculateStringMatch(search: string, target: string): number {
    // Exact match
    if (search === target) return 100;

    // Contains match
    if (target.includes(search)) return 80;

    // Word match
    const searchWords = search.split(/\s+/);
    const targetWords = target.split(/\s+/);
    const matchedWords = searchWords.filter(sw =>
      targetWords.some(tw => tw.includes(sw) || sw.includes(tw))
    );

    return (matchedWords.length / searchWords.length) * 70;
  }

  // ============================================
  // Customer Information Retrieval
  // ============================================

  private async getCustomerSummary(
    customerName: string,
    userId: string
  ): Promise<{ response: string; data?: any }> {
    const customer = await this.findCustomerByName(customerName, userId);

    if (!customer || !this.supabase) {
      return {
        response: `Could not find information for "${customerName}"`,
      };
    }

    const { data } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', customer.id)
      .single();

    if (!data) {
      return { response: `No details found for ${customer.name}` };
    }

    const response = `${data.name} is a ${data.tier || 'standard'} tier customer ` +
      `with ${data.arr ? '$' + data.arr.toLocaleString() + ' ARR' : 'no ARR recorded'}. ` +
      `Health score is ${data.health_score || 'unknown'}%. ` +
      `${data.renewal_date ? 'Renewal is on ' + new Date(data.renewal_date).toLocaleDateString() : 'No renewal date set'}.`;

    return { response, data };
  }

  private async getHealthScore(
    customerName: string,
    userId: string
  ): Promise<{ response: string; data?: any }> {
    const customer = await this.findCustomerByName(customerName, userId);

    if (!customer || !this.supabase) {
      return { response: `Could not find "${customerName}"` };
    }

    const { data } = await this.supabase
      .from('customers')
      .select('name, health_score')
      .eq('id', customer.id)
      .single();

    if (!data) {
      return { response: `No health data for ${customer.name}` };
    }

    const score = data.health_score || 0;
    const status = score >= 80 ? 'healthy' : score >= 60 ? 'at risk' : 'critical';

    return {
      response: `${data.name}'s health score is ${score}%, which is ${status}.`,
      data: { name: data.name, healthScore: score, status },
    };
  }

  private async getRenewalInfo(
    customerName: string,
    userId: string
  ): Promise<{ response: string; data?: any }> {
    const customer = await this.findCustomerByName(customerName, userId);

    if (!customer || !this.supabase) {
      return { response: `Could not find "${customerName}"` };
    }

    const { data } = await this.supabase
      .from('customers')
      .select('name, renewal_date, arr')
      .eq('id', customer.id)
      .single();

    if (!data || !data.renewal_date) {
      return { response: `No renewal date set for ${customer.name}` };
    }

    const renewalDate = new Date(data.renewal_date);
    const daysUntil = Math.ceil(
      (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return {
      response: `${data.name}'s renewal is on ${renewalDate.toLocaleDateString()}, ${daysUntil} days from now. ARR is ${data.arr ? '$' + data.arr.toLocaleString() : 'not set'}.`,
      data: { name: data.name, renewalDate: data.renewal_date, daysUntil, arr: data.arr },
    };
  }

  private async getChurnRisk(
    customerName: string,
    userId: string
  ): Promise<{ response: string; data?: any }> {
    const customer = await this.findCustomerByName(customerName, userId);

    if (!customer || !this.supabase) {
      return { response: `Could not find "${customerName}"` };
    }

    // Get customer and recent insights
    const { data: customerData } = await this.supabase
      .from('customers')
      .select('name, health_score')
      .eq('id', customer.id)
      .single();

    const { data: insights } = await this.supabase
      .from('insights')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('type', 'risk')
      .order('created_at', { ascending: false })
      .limit(3);

    const score = customerData?.health_score || 70;
    const riskLevel = score >= 80 ? 'low' : score >= 60 ? 'medium' : 'high';

    let response = `${customer.name} has ${riskLevel} churn risk with a health score of ${score}%.`;

    if (insights && insights.length > 0) {
      response += ` Recent risk signals: ${insights.map(i => i.title).join(', ')}.`;
    }

    return {
      response,
      data: { name: customer.name, riskLevel, healthScore: score, insights },
    };
  }

  private async getCustomerTasks(
    customerName: string,
    userId: string
  ): Promise<{ response: string; data?: any }> {
    const customer = await this.findCustomerByName(customerName, userId);

    if (!customer || !this.supabase) {
      return { response: `Could not find "${customerName}"` };
    }

    const { data: tasks } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('customer_id', customer.id)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true })
      .limit(5);

    if (!tasks || tasks.length === 0) {
      return {
        response: `No pending tasks for ${customer.name}`,
        data: { tasks: [] },
      };
    }

    const taskList = tasks.map((t, i) => `${i + 1}. ${t.title}`).join('. ');

    return {
      response: `${customer.name} has ${tasks.length} pending tasks: ${taskList}`,
      data: { tasks },
    };
  }

  // ============================================
  // Voice Settings Management
  // ============================================

  /**
   * Get voice settings for a user
   */
  async getSettings(userId: string): Promise<VoiceSettings | null> {
    if (!this.supabase) {
      return this.getDefaultSettings(userId);
    }

    const { data, error } = await this.supabase
      .from('voice_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return this.getDefaultSettings(userId);
    }

    return {
      userId: data.user_id,
      voiceEnabled: data.voice_enabled,
      continuousListening: data.continuous_listening,
      speechRate: data.speech_rate,
      voiceResponseEnabled: data.voice_response_enabled,
      summaryMode: data.summary_mode,
      confirmDestructiveActions: data.confirm_destructive_actions,
      language: data.language,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Update voice settings for a user
   */
  async updateSettings(
    userId: string,
    settings: Partial<VoiceSettings>
  ): Promise<VoiceSettings> {
    if (!this.supabase) {
      return { ...this.getDefaultSettings(userId), ...settings };
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (settings.voiceEnabled !== undefined) updateData.voice_enabled = settings.voiceEnabled;
    if (settings.continuousListening !== undefined) updateData.continuous_listening = settings.continuousListening;
    if (settings.speechRate !== undefined) updateData.speech_rate = settings.speechRate;
    if (settings.voiceResponseEnabled !== undefined) updateData.voice_response_enabled = settings.voiceResponseEnabled;
    if (settings.summaryMode !== undefined) updateData.summary_mode = settings.summaryMode;
    if (settings.confirmDestructiveActions !== undefined) updateData.confirm_destructive_actions = settings.confirmDestructiveActions;
    if (settings.language !== undefined) updateData.language = settings.language;

    const { data, error } = await this.supabase
      .from('voice_settings')
      .upsert({
        user_id: userId,
        ...updateData,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update voice settings: ${error.message}`);
    }

    return {
      userId: data.user_id,
      voiceEnabled: data.voice_enabled,
      continuousListening: data.continuous_listening,
      speechRate: data.speech_rate,
      voiceResponseEnabled: data.voice_response_enabled,
      summaryMode: data.summary_mode,
      confirmDestructiveActions: data.confirm_destructive_actions,
      language: data.language,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(userId: string): VoiceSettings {
    return {
      userId,
      voiceEnabled: true,
      continuousListening: false,
      speechRate: 1.0,
      voiceResponseEnabled: true,
      summaryMode: false,
      confirmDestructiveActions: true,
      language: 'en-US',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ============================================
  // Command Registry
  // ============================================

  /**
   * Get all registered commands
   */
  getCommands(): VoiceCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: VoiceCommand['category']): VoiceCommand[] {
    return this.getCommands().filter(cmd => cmd.category === category);
  }

  /**
   * Register a custom command
   */
  registerCommand(command: VoiceCommand): void {
    this.commands.set(command.id, command);
  }
}

// Singleton instance
export const voiceCommandService = new VoiceCommandService();
