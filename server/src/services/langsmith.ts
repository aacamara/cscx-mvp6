/**
 * LangSmith Integration Service
 * Deep tracing and observability for AI agent execution
 * Sends traces to LangSmith for analysis and debugging
 */

import { Client } from 'langsmith';
import { RunTree, RunTreeConfig } from 'langsmith/run_trees';

// ============================================
// Configuration
// ============================================

const LANGSMITH_ENABLED = process.env.LANGCHAIN_TRACING_V2 === 'true';
const LANGSMITH_API_KEY = process.env.LANGCHAIN_API_KEY;
const LANGSMITH_PROJECT = process.env.LANGCHAIN_PROJECT || 'cscx-agents';
const LANGSMITH_ENDPOINT = process.env.LANGCHAIN_ENDPOINT || 'https://api.smith.langchain.com';

// ============================================
// LangSmith Client
// ============================================

let langsmithClient: Client | null = null;

function getClient(): Client | null {
  if (!LANGSMITH_ENABLED || !LANGSMITH_API_KEY) {
    return null;
  }

  if (!langsmithClient) {
    langsmithClient = new Client({
      apiKey: LANGSMITH_API_KEY,
      apiUrl: LANGSMITH_ENDPOINT,
    });
    console.log(`🔍 LangSmith client initialized for project: ${LANGSMITH_PROJECT}`);
  }

  return langsmithClient;
}

// ============================================
// Run Tracking
// ============================================

interface TrackedRun {
  runTree: RunTree;
  childRuns: Map<string, RunTree>;
}

const activeRuns = new Map<string, TrackedRun>();

// ============================================
// Public API
// ============================================

export interface LangSmithRunConfig {
  name: string;
  runType: 'chain' | 'llm' | 'tool' | 'retriever' | 'embedding' | 'prompt';
  inputs: Record<string, any>;
  metadata?: Record<string, any>;
  tags?: string[];
  parentRunId?: string;
}

/**
 * Start a new LangSmith run
 */
export async function startRun(runId: string, config: LangSmithRunConfig): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    const runTreeConfig: RunTreeConfig = {
      name: config.name,
      run_type: config.runType,
      inputs: config.inputs,
      project_name: LANGSMITH_PROJECT,
      client: client,
      extra: {
        metadata: config.metadata || {},
        tags: config.tags || [],
      },
    };

    // If this is a child run, find the parent
    if (config.parentRunId && activeRuns.has(config.parentRunId)) {
      const parent = activeRuns.get(config.parentRunId)!;
      const childRun = await parent.runTree.createChild(runTreeConfig);
      parent.childRuns.set(runId, childRun);
    } else {
      const runTree = new RunTree(runTreeConfig);
      await runTree.postRun();
      activeRuns.set(runId, {
        runTree,
        childRuns: new Map(),
      });
    }
  } catch (error) {
    console.error('LangSmith startRun error:', error);
  }
}

/**
 * End a LangSmith run
 */
export async function endRun(
  runId: string,
  outputs: Record<string, any>,
  error?: string
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    // Check if this is a child run
    for (const [parentId, tracked] of activeRuns) {
      if (tracked.childRuns.has(runId)) {
        const childRun = tracked.childRuns.get(runId)!;
        if (error) {
          await childRun.end({ error });
        } else {
          await childRun.end({ outputs });
        }
        await childRun.patchRun();
        tracked.childRuns.delete(runId);
        return;
      }
    }

    // Otherwise it's a root run
    const tracked = activeRuns.get(runId);
    if (tracked) {
      if (error) {
        await tracked.runTree.end({ error });
      } else {
        await tracked.runTree.end({ outputs });
      }
      await tracked.runTree.patchRun();
      activeRuns.delete(runId);
    }
  } catch (error) {
    console.error('LangSmith endRun error:', error);
  }
}

/**
 * Log a step/event within a run
 */
export async function logStep(
  parentRunId: string,
  stepConfig: {
    stepId: string;
    name: string;
    type: 'llm' | 'tool' | 'chain';
    inputs: Record<string, any>;
    outputs?: Record<string, any>;
    error?: string;
  }
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    const tracked = activeRuns.get(parentRunId);
    if (!tracked) return;

    const childConfig: RunTreeConfig = {
      name: stepConfig.name,
      run_type: stepConfig.type,
      inputs: stepConfig.inputs,
      project_name: LANGSMITH_PROJECT,
      client: client,
    };

    const childRun = await tracked.runTree.createChild(childConfig);

    if (stepConfig.error) {
      await childRun.end({ error: stepConfig.error });
    } else if (stepConfig.outputs) {
      await childRun.end({ outputs: stepConfig.outputs });
    }

    await childRun.patchRun();
  } catch (error) {
    console.error('LangSmith logStep error:', error);
  }
}

/**
 * Create feedback for a run (for evaluation)
 */
export async function createFeedback(
  runId: string,
  key: string,
  score: number,
  comment?: string
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.createFeedback(runId, key, {
      score,
      comment,
    });
  } catch (error) {
    console.error('LangSmith createFeedback error:', error);
  }
}

/**
 * Check if LangSmith is enabled
 */
export function isEnabled(): boolean {
  return LANGSMITH_ENABLED && !!LANGSMITH_API_KEY;
}

/**
 * Get LangSmith project info
 */
export function getProjectInfo(): { enabled: boolean; project: string; endpoint: string } {
  return {
    enabled: isEnabled(),
    project: LANGSMITH_PROJECT,
    endpoint: LANGSMITH_ENDPOINT,
  };
}

// Export default client accessor
export { getClient };
