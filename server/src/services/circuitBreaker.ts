/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures by stopping calls to failing services
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Number of successes in HALF_OPEN before closing */
  successThreshold: number;
  /** Time in ms before attempting to close an open circuit */
  timeout: number;
  /** Optional name for logging */
  name?: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000 // 30 seconds
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      name
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is OPEN
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker [${this.options.name}] is OPEN. Request blocked.`,
          this.options.name
        );
      }
    }

    this.totalCalls++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute with optional fallback
   */
  async executeWithFallback<T>(
    fn: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        console.log(`[CircuitBreaker:${this.options.name}] Using fallback due to open circuit`);
        return fallback();
      }
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.options.timeout;
  }

  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();
    this.failures = 0;
    this.successes++;

    if (this.state === 'HALF_OPEN') {
      if (this.successes >= this.options.successThreshold) {
        this.transitionTo('CLOSED');
        this.successes = 0;
      }
    }
  }

  private onFailure(): void {
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.failures++;
    this.successes = 0;

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN immediately opens the circuit
      this.transitionTo('OPEN');
    } else if (this.failures >= this.options.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    console.log(
      `[CircuitBreaker:${this.options.name}] State transition: ${oldState} -> ${newState}`
    );
  }

  /**
   * Get current circuit breaker stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : undefined,
      lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime) : undefined,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is allowing requests
   */
  isAllowingRequests(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') return true;
    if (this.state === 'OPEN' && this.shouldAttemptReset()) return true;
    return false;
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    console.log(`[CircuitBreaker:${this.options.name}] Manually reset to CLOSED`);
  }

  /**
   * Force the circuit open (for testing or manual intervention)
   */
  forceOpen(): void {
    this.transitionTo('OPEN');
    this.lastFailureTime = Date.now();
    console.log(`[CircuitBreaker:${this.options.name}] Manually forced OPEN`);
  }
}

/**
 * Custom error for circuit breaker rejections
 */
export class CircuitBreakerError extends Error {
  public readonly circuitName: string;

  constructor(message: string, circuitName: string) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.circuitName = circuitName;
  }
}

/**
 * Pre-configured circuit breakers for common services
 */
export const circuitBreakers = {
  claude: new CircuitBreaker('claude', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000 // 1 minute
  }),
  gemini: new CircuitBreaker('gemini', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000
  }),
  supabase: new CircuitBreaker('supabase', {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000
  })
};

/**
 * Get stats for all circuit breakers
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};
  for (const [name, breaker] of Object.entries(circuitBreakers)) {
    stats[name] = breaker.getStats();
  }
  return stats;
}
