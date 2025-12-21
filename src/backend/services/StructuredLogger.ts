// ============================================================
// Structured Logger Service - Observability
// Provides structured logging with runId + workspaceId context
// ============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  runId?: string;
  workspaceId?: string;
  tenantId?: string;
  userId?: string;
  templateId?: string;
  datasetId?: string;
  optimizerType?: string;
  metricType?: string;
  stage?: string;
  progress?: number;
  duration?: number;
  cost?: {
    calls?: number;
    tokens?: number;
    usd?: number;
  };
  error?: string;
  errorStack?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  service: string;
}

export class StructuredLogger {
  private service: string;
  private baseContext: LogContext;

  constructor(service: string, baseContext: LogContext = {}) {
    this.service = service;
    this.baseContext = baseContext;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): StructuredLogger {
    return new StructuredLogger(this.service, {
      ...this.baseContext,
      ...additionalContext,
    });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context: LogContext = {}): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context: LogContext = {}): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context: LogContext = {}): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, context: LogContext = {}): void {
    this.log('error', message, context);
  }

  /**
   * Log with error object
   */
  errorWithStack(message: string, error: Error, context: LogContext = {}): void {
    this.log('error', message, {
      ...context,
      error: error.message,
      errorStack: error.stack,
    });
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...this.baseContext,
        ...context,
      },
      service: this.service,
    };

    // Format for console output
    const contextStr = Object.entries(entry.context)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ');

    const logLine = `[${entry.timestamp}] [${level.toUpperCase()}] [${this.service}] ${message} ${contextStr}`;

    // Output based on level
    switch (level) {
      case 'debug':
        console.debug(logLine);
        break;
      case 'info':
        console.info(logLine);
        break;
      case 'warn':
        console.warn(logLine);
        break;
      case 'error':
        console.error(logLine);
        break;
    }

    // In production, you could also send to external logging service
    // e.g., Datadog, Splunk, CloudWatch, etc.
  }
}

// ============================================================
// Pre-configured loggers for different services
// ============================================================

export const optimizationLogger = new StructuredLogger('optimization');
export const evaluationLogger = new StructuredLogger('evaluation');
export const workerLogger = new StructuredLogger('worker');
export const metricsLogger = new StructuredLogger('metrics');
