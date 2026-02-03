/**
 * useNaturalLanguageTask Hook
 * PRD-234: Natural Language Task Creation
 *
 * Custom hook for creating tasks from natural language input.
 * Handles parsing, preview, editing, and task creation.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  NaturalLanguageTaskState,
  UseNaturalLanguageTaskReturn,
  ParsedTask,
  SuggestedTask,
  CreateTaskFromNLResponse,
  BatchParseResult,
  BatchCreateResponse,
  UserContext,
} from '../types/naturalLanguageTask';

const API_URL = import.meta.env.VITE_API_URL || '';

const initialState: NaturalLanguageTaskState = {
  input: '',
  isTyping: false,
  isParsing: false,
  parseError: null,
  parsed: null,
  suggestedTask: null,
  ambiguities: [],
  confirmationsNeeded: [],
  isEditing: false,
  editedTask: null,
  isCreating: false,
  createError: null,
  createdTask: null,
  isBatchMode: false,
  batchItems: [],
  selectedBatchItems: new Set(),
};

/**
 * Hook for natural language task creation
 */
export function useNaturalLanguageTask(
  defaultContext?: UserContext
): UseNaturalLanguageTaskReturn {
  const [state, setState] = useState<NaturalLanguageTaskState>(initialState);

  // Track typing timeout for debounced parsing
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Context for parsing
  const contextRef = useRef<UserContext>(defaultContext || {});

  /**
   * Set input text
   */
  const setInput = useCallback((input: string) => {
    setState((prev) => ({
      ...prev,
      input,
      isTyping: true,
      // Clear previous parse results when input changes
      parsed: null,
      suggestedTask: null,
      parseError: null,
      ambiguities: [],
      confirmationsNeeded: [],
    }));

    // Debounce typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setState((prev) => ({ ...prev, isTyping: false }));
    }, 500);
  }, []);

  /**
   * Clear input
   */
  const clearInput = useCallback(() => {
    setState((prev) => ({
      ...prev,
      input: '',
      isTyping: false,
      parsed: null,
      suggestedTask: null,
      parseError: null,
      ambiguities: [],
      confirmationsNeeded: [],
    }));
  }, []);

  /**
   * Parse task from natural language input
   */
  const parseTask = useCallback(async (inputOverride?: string) => {
    const inputToParse = inputOverride || state.input;

    if (!inputToParse.trim()) {
      setState((prev) => ({
        ...prev,
        parseError: 'Please enter a task description',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isParsing: true,
      parseError: null,
      isTyping: false,
    }));

    try {
      const userId = localStorage.getItem('userId') || '';
      const response = await fetch(`${API_URL}/api/tasks/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': userId } : {}),
        },
        body: JSON.stringify({
          input: inputToParse,
          context: contextRef.current,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to parse task');
      }

      setState((prev) => ({
        ...prev,
        isParsing: false,
        parsed: data.parsed,
        suggestedTask: data.suggested_task,
        ambiguities: data.ambiguities || [],
        confirmationsNeeded: data.confirmations_needed || [],
      }));
    } catch (error) {
      console.error('Error parsing task:', error);
      setState((prev) => ({
        ...prev,
        isParsing: false,
        parseError: error instanceof Error ? error.message : 'Failed to parse task',
      }));
    }
  }, [state.input]);

  /**
   * Parse multiple tasks in batch mode
   */
  const parseBatch = useCallback(
    async (items: string[], source?: string) => {
      if (!items || items.length === 0) {
        setState((prev) => ({
          ...prev,
          parseError: 'No items to parse',
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isParsing: true,
        parseError: null,
        isBatchMode: true,
        batchItems: [],
        selectedBatchItems: new Set(),
      }));

      try {
        const userId = localStorage.getItem('userId') || '';
        const response = await fetch(`${API_URL}/api/tasks/batch-parse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(userId ? { 'x-user-id': userId } : {}),
          },
          body: JSON.stringify({
            items,
            source: source || 'manual',
            context: contextRef.current,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error?.message || 'Failed to parse batch');
        }

        // Auto-select high-confidence items
        const highConfidenceIndices = new Set<number>();
        data.tasks.forEach((task: BatchParseResult, index: number) => {
          if (task.success && task.confidence >= 0.8) {
            highConfidenceIndices.add(index);
          }
        });

        setState((prev) => ({
          ...prev,
          isParsing: false,
          batchItems: data.tasks,
          selectedBatchItems: highConfidenceIndices,
        }));
      } catch (error) {
        console.error('Error parsing batch:', error);
        setState((prev) => ({
          ...prev,
          isParsing: false,
          parseError: error instanceof Error ? error.message : 'Failed to parse batch',
        }));
      }
    },
    []
  );

  /**
   * Start editing the suggested task
   */
  const startEditing = useCallback(() => {
    setState((prev) => {
      if (!prev.suggestedTask) return prev;

      return {
        ...prev,
        isEditing: true,
        editedTask: { ...prev.suggestedTask },
      };
    });
  }, []);

  /**
   * Update edited task field
   */
  const updateEdit = useCallback(
    (field: keyof SuggestedTask, value: unknown) => {
      setState((prev) => {
        if (!prev.editedTask) return prev;

        return {
          ...prev,
          editedTask: {
            ...prev.editedTask,
            [field]: value,
          },
        };
      });
    },
    []
  );

  /**
   * Cancel editing
   */
  const cancelEdit = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isEditing: false,
      editedTask: null,
    }));
  }, []);

  /**
   * Create task from natural language
   */
  const createTask = useCallback(
    async (overrides?: Partial<SuggestedTask>): Promise<CreateTaskFromNLResponse> => {
      const inputToUse = state.input;

      if (!inputToUse.trim()) {
        return {
          success: false,
          error: 'Please enter a task description',
        };
      }

      setState((prev) => ({
        ...prev,
        isCreating: true,
        createError: null,
      }));

      try {
        const userId = localStorage.getItem('userId') || '';

        // Merge any overrides with edited task
        const finalOverrides = {
          ...(state.editedTask || {}),
          ...(overrides || {}),
        };

        const response = await fetch(`${API_URL}/api/tasks/create-from-nl`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(userId ? { 'x-user-id': userId } : {}),
          },
          body: JSON.stringify({
            input: inputToUse,
            context: contextRef.current,
            auto_confirm: true,
            overrides: finalOverrides,
          }),
        });

        const data: CreateTaskFromNLResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to create task');
        }

        setState((prev) => ({
          ...prev,
          isCreating: false,
          createdTask: data.task || null,
          // Reset editing state
          isEditing: false,
          editedTask: null,
        }));

        return data;
      } catch (error) {
        console.error('Error creating task:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to create task';

        setState((prev) => ({
          ...prev,
          isCreating: false,
          createError: errorMessage,
        }));

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [state.input, state.editedTask]
  );

  /**
   * Create tasks from batch
   */
  const createBatchTasks = useCallback(
    async (selectedOnly: boolean = true): Promise<BatchCreateResponse> => {
      const tasksToCreate = state.batchItems
        .map((item, index) => ({
          input: item.input,
          overrides: item.suggested_task ? {} : undefined,
          confirmed: selectedOnly ? state.selectedBatchItems.has(index) : item.success,
          index,
        }))
        .filter((item) => item.confirmed);

      if (tasksToCreate.length === 0) {
        return {
          success: false,
          created: 0,
          failed: 0,
          tasks: [],
        };
      }

      setState((prev) => ({
        ...prev,
        isCreating: true,
        createError: null,
      }));

      try {
        const userId = localStorage.getItem('userId') || '';
        const response = await fetch(`${API_URL}/api/tasks/batch-create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(userId ? { 'x-user-id': userId } : {}),
          },
          body: JSON.stringify({
            tasks: tasksToCreate.map((t) => ({
              input: t.input,
              overrides: t.overrides,
              confirmed: true,
            })),
            context: contextRef.current,
          }),
        });

        const data: BatchCreateResponse = await response.json();

        if (!response.ok) {
          throw new Error('Failed to create batch tasks');
        }

        setState((prev) => ({
          ...prev,
          isCreating: false,
        }));

        return data;
      } catch (error) {
        console.error('Error creating batch tasks:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create batch tasks';

        setState((prev) => ({
          ...prev,
          isCreating: false,
          createError: errorMessage,
        }));

        return {
          success: false,
          created: 0,
          failed: 0,
          tasks: [],
        };
      }
    },
    [state.batchItems, state.selectedBatchItems]
  );

  /**
   * Toggle batch item selection
   */
  const toggleBatchItem = useCallback((index: number) => {
    setState((prev) => {
      const newSelected = new Set(prev.selectedBatchItems);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      return {
        ...prev,
        selectedBatchItems: newSelected,
      };
    });
  }, []);

  /**
   * Select all batch items
   */
  const selectAllBatchItems = useCallback(() => {
    setState((prev) => {
      const newSelected = new Set<number>();
      prev.batchItems.forEach((item, index) => {
        if (item.success) {
          newSelected.add(index);
        }
      });
      return {
        ...prev,
        selectedBatchItems: newSelected,
      };
    });
  }, []);

  /**
   * Deselect all batch items
   */
  const deselectAllBatchItems = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedBatchItems: new Set(),
    }));
  }, []);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * Update context
   */
  const updateContext = useCallback((context: Partial<UserContext>) => {
    contextRef.current = {
      ...contextRef.current,
      ...context,
    };
  }, []);

  return {
    state,
    setInput,
    clearInput,
    parseTask,
    parseBatch,
    startEditing,
    updateEdit,
    cancelEdit,
    createTask,
    createBatchTasks,
    toggleBatchItem,
    selectAllBatchItems,
    deselectAllBatchItems,
    reset,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get priority color for display
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high':
      return '#ef4444'; // Red
    case 'medium':
      return '#f59e0b'; // Amber
    case 'low':
      return '#10b981'; // Green
    default:
      return '#6b7280'; // Gray
  }
}

/**
 * Get priority label for display
 */
export function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'high':
      return 'High Priority';
    case 'medium':
      return 'Medium Priority';
    case 'low':
      return 'Low Priority';
    default:
      return priority;
  }
}

/**
 * Get task type icon
 */
export function getTaskTypeIcon(taskType: string): string {
  const icons: Record<string, string> = {
    follow_up: '🔄',
    send: '📤',
    schedule: '📅',
    review: '🔍',
    call: '📞',
    email: '✉️',
    research: '🔬',
    meeting: '👥',
    documentation: '📝',
    other: '📋',
  };
  return icons[taskType] || '📋';
}

/**
 * Get task type label
 */
export function getTaskTypeLabel(taskType: string): string {
  const labels: Record<string, string> = {
    follow_up: 'Follow Up',
    send: 'Send',
    schedule: 'Schedule',
    review: 'Review',
    call: 'Call',
    email: 'Email',
    research: 'Research',
    meeting: 'Meeting',
    documentation: 'Documentation',
    other: 'Other',
  };
  return labels[taskType] || taskType;
}

/**
 * Format confidence as percentage
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Get confidence color
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#10b981'; // Green
  if (confidence >= 0.6) return '#f59e0b'; // Amber
  return '#ef4444'; // Red
}

export default useNaturalLanguageTask;
