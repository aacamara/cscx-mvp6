/**
 * Retry with Exponential Backoff
 * Handles transient failures with configurable retry logic
 */

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  baseDelay: number;
  /** Maximum delay cap in milliseconds */
  maxDelay: number;
  /** Base for exponential calculation (default: 2) */
  exponentialBase: number;
  /** Patterns to match for retryable errors */
  retryableErrors?: string[];
  /** Callback for retry events */
  onRetry?: (attempt: number, error: Error, nextDelay: number) => void;
  /** Whether to add jitter to prevent thundering herd */
  jitter?: boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  exponentialBase: 2,
  jitter: true
};

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (opts.retryableErrors && opts.retryableErrors.length > 0) {
        const isRetryable = opts.retryableErrors.some(pattern =>
          lastError!.message.toLowerCase().includes(pattern.toLowerCase())
        );
        if (!isRetryable) {
          throw lastError;
        }
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(
        opts.baseDelay * Math.pow(opts.exponentialBase, attempt),
        opts.maxDelay
      );

      // Add jitter (up to 25% of delay)
      if (opts.jitter) {
        delay += Math.random() * (delay * 0.25);
      }

      // Notify callback
      opts.onRetry?.(attempt + 1, lastError, delay);

      // Wait before next attempt
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Decorator version for class methods
 */
export function Retry(options: Partial<RetryOptions> = {}) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Create a retryable version of a function
 */
export function createRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: Partial<RetryOptions> = {}
): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Pre-configured retry strategies for common scenarios
 */
export const retryStrategies = {
  /**
   * For AI API calls - retry on rate limits and temporary failures
   */
  aiService: {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 30000,
    exponentialBase: 2,
    jitter: true,
    retryableErrors: [
      'rate limit',
      'timeout',
      'temporary',
      '503',
      '429',
      '500',
      'overloaded',
      'capacity',
      'try again',
      'ECONNRESET',
      'ETIMEDOUT'
    ],
    onRetry: (attempt: number, error: Error, nextDelay: number) => {
      console.log(
        `[Retry:AI] Attempt ${attempt} failed: ${error.message}. Retrying in ${Math.round(nextDelay)}ms`
      );
    }
  } as RetryOptions,

  /**
   * For database operations
   */
  database: {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 5000,
    exponentialBase: 2,
    jitter: true,
    retryableErrors: [
      'connection',
      'timeout',
      'deadlock',
      'ECONNREFUSED',
      'too many connections'
    ],
    onRetry: (attempt: number, error: Error, nextDelay: number) => {
      console.log(
        `[Retry:DB] Attempt ${attempt} failed: ${error.message}. Retrying in ${Math.round(nextDelay)}ms`
      );
    }
  } as RetryOptions,

  /**
   * Quick retry for simple operations
   */
  quick: {
    maxRetries: 2,
    baseDelay: 100,
    maxDelay: 1000,
    exponentialBase: 2,
    jitter: true
  } as RetryOptions,

  /**
   * Aggressive retry for critical operations
   */
  critical: {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 60000,
    exponentialBase: 2,
    jitter: true,
    onRetry: (attempt: number, error: Error, nextDelay: number) => {
      console.warn(
        `[Retry:Critical] Attempt ${attempt} failed: ${error.message}. Retrying in ${Math.round(nextDelay)}ms`
      );
    }
  } as RetryOptions,

  /**
   * No retry - immediate failure
   */
  none: {
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    exponentialBase: 1
  } as RetryOptions
};

/**
 * Combine retry with timeout
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  retryOptions: Partial<RetryOptions> = {}
): Promise<T> {
  return withRetry(async () => {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      )
    ]);
  }, retryOptions);
}
