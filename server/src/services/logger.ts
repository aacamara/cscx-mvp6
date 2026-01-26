/**
 * Structured Logger
 * JSON format optimized for Google Cloud Logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  severity: string;
  message: string;
  service: string;
  component?: string;
  traceId?: string;
  spanId?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  httpRequest?: {
    method: string;
    url: string;
    status?: number;
    latency?: string;
    userAgent?: string;
    remoteIp?: string;
  };
}

// Log level priority
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// GCP severity mapping
const GCP_SEVERITY: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR'
};

export class Logger {
  private service: string;
  private component?: string;
  private minLevel: LogLevel;
  private isProduction: boolean;

  constructor(service: string = 'cscx-api', component?: string) {
    this.service = service;
    this.component = component;
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      severity: GCP_SEVERITY[level],
      message,
      service: this.service
    };

    if (this.component) {
      entry.component = this.component;
    }

    // Extract trace context from environment (set by Cloud Run)
    const traceHeader = process.env.X_CLOUD_TRACE_CONTEXT;
    if (traceHeader) {
      const [traceId, spanId] = traceHeader.split('/');
      entry.traceId = traceId;
      if (spanId) {
        entry.spanId = spanId.split(';')[0];
      }
    }

    if (data && Object.keys(data).length > 0) {
      entry.data = data;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    // In production, output as JSON for Cloud Logging
    // In development, output as readable format
    if (this.isProduction) {
      const output = JSON.stringify(entry);

      switch (entry.severity) {
        case 'ERROR':
          console.error(output);
          break;
        case 'WARNING':
          console.warn(output);
          break;
        case 'DEBUG':
          console.debug(output);
          break;
        default:
          console.log(output);
      }
    } else {
      // Development format
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      const prefix = `[${timestamp}] [${entry.severity}]`;
      const component = entry.component ? ` [${entry.component}]` : '';

      let message = `${prefix}${component} ${entry.message}`;

      if (entry.data) {
        message += ` ${JSON.stringify(entry.data)}`;
      }

      if (entry.error) {
        message += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
        if (entry.error.stack) {
          message += `\n${entry.error.stack}`;
        }
      }

      switch (entry.severity) {
        case 'ERROR':
          console.error(message);
          break;
        case 'WARNING':
          console.warn(message);
          break;
        case 'DEBUG':
          console.debug(message);
          break;
        default:
          console.log(message);
      }
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, data));
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, data));
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, data));
    }
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      this.output(this.formatEntry('error', message, data, error));
    }
  }

  /**
   * Log an HTTP request
   */
  httpRequest(
    method: string,
    url: string,
    statusCode: number,
    latencyMs: number,
    data?: Record<string, unknown>
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    if (this.shouldLog(level)) {
      const entry = this.formatEntry(level, `${method} ${url} ${statusCode}`, data);
      entry.httpRequest = {
        method,
        url,
        status: statusCode,
        latency: `${latencyMs}ms`
      };
      this.output(entry);
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(component: string): Logger {
    const childLogger = new Logger(this.service, component);
    childLogger.minLevel = this.minLevel;
    return childLogger;
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience function for one-off logs
export function log(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
  error?: Error
): void {
  switch (level) {
    case 'debug':
      logger.debug(message, data);
      break;
    case 'info':
      logger.info(message, data);
      break;
    case 'warn':
      logger.warn(message, data);
      break;
    case 'error':
      logger.error(message, error, data);
      break;
  }
}
