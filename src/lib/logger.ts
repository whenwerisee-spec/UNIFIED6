/**
 * Global Logger Instance
 * Used throughout the application for centralized logging with correlation IDs
 */

import { createStructuredLogger, StructuredLogger } from './structured-logger.js';

let globalLogger: StructuredLogger | null = null;

/**
 * Initialize the global logger instance (called once at startup)
 */
export function initializeLogger(): StructuredLogger {
  if (!globalLogger) {
    globalLogger = createStructuredLogger('app', {
      service: 'marshall-banking-hub',
      environment: process.env.NODE_ENV || 'development'
    });
  }
  return globalLogger;
}

/**
 * Get the global logger instance
 */
export function getLogger(context?: Record<string, any>): StructuredLogger {
  if (!globalLogger) {
    initializeLogger();
  }
  return context ? globalLogger!.withContext(context) : globalLogger!;
}

/**
 * Create a request-scoped logger with correlation ID
 */
export function createRequestLogger(correlationId: string, userId?: string): StructuredLogger {
  return getLogger({
    correlationId,
    userId,
    requestStartTime: Date.now()
  });
}

/**
 * Log security events (authentication, authorization, suspicious activity)
 */
export function logSecurityEvent(
  event: 'LOGIN' | 'LOGIN_FAILED' | 'ACCOUNT_LOCKED' | 'UNAUTHORIZED_ACCESS' | 'PERMISSION_DENIED' | 'SUSPICIOUS_ACTIVITY',
  details: Record<string, any>
): void {
  const logger = getLogger();
  const level = event.includes('FAILED') || event.includes('LOCKED') || event.includes('UNAUTHORIZED') || event.includes('DENIED') ? 'WARN' : 'INFO';
  
  if (level === 'WARN') {
    logger.warn(`[SECURITY] ${event}`, details);
  } else {
    logger.info(`[SECURITY] ${event}`, details);
  }
}

/**
 * Log transaction events (trades, withdrawals, deposits, etc.)
 */
export function logTransactionEvent(
  type: string,
  statusOrDetails: any,
  details?: Record<string, any>
): void {
  const logger = getLogger();
  if (typeof statusOrDetails === 'object' && !details) {
    logger.info(`[TRANSACTION] ${type}`, statusOrDetails);
  } else {
    logger.info(`[TRANSACTION] ${type} - ${statusOrDetails}`, details || {});
  }
}

/**
 * Log provider/integration events
 */
export function logProviderEvent(
  provider: string,
  event: string,
  details?: Record<string, any>
): void {
  const logger = getLogger();
  const level = event === 'ERROR' || event === 'TIMEOUT' ? 'ERROR' : 'WARN';
  
  if (level === 'ERROR') {
    logger.error(`[PROVIDER] ${provider} - ${event}`, details || {});
  } else {
    logger.warn(`[PROVIDER] ${provider} - ${event}`, details || {});
  }
}

/**
 * Log database operations
 */
export function logDatabaseEvent(
  operation: string,
  table: string,
  details?: Record<string, any>
): void {
  const logger = getLogger();
  logger.debug(`[DATABASE] ${operation} on ${table}`, details || {});
}

/**
 * Log system/infrastructure events
 */
export function logSystemEvent(
  event: string,
  details?: Record<string, any>
): void {
  const logger = getLogger();
  const level = event === 'ERROR' ? 'ERROR' : event === 'WARNING' ? 'WARN' : 'INFO';
  
  if (level === 'ERROR') {
    logger.error(`[SYSTEM] ${event}`, details || {});
  } else if (level === 'WARN') {
    logger.warn(`[SYSTEM] ${event}`, details || {});
  } else {
    logger.info(`[SYSTEM] ${event}`, details || {});
  }
}
