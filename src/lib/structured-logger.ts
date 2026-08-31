import fs from 'fs';
import path from 'path';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  requestId?: string;
  sessionId?: string;
  operationType?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  message: string;
  context: LogContext;
  stack?: string;
  service: string;
  timestamp: string;
}

export class StructuredLogger {
  private service: string;
  private context: LogContext = {};
  private logFile?: string;

  constructor(service: string, context?: LogContext, logFile?: string) {
    this.service = service;
    this.context = context || {};
    this.logFile = logFile;
  }

  private formatEntry(level: string, message: string, meta: any = {}): LogEntry {
    return {
      level: level as any,
      message,
      context: { ...this.context, ...meta },
      service: this.service,
      timestamp: new Date().toISOString()
    };
  }

  private writeLog(entry: LogEntry) {
    const jsonLog = JSON.stringify(entry);
    
    // Always log to console for real-time monitoring
    const consolePrefix = `[${entry.timestamp}] [${entry.service}] [${entry.level}]`;
    console.log(`${consolePrefix} ${entry.message}`, entry.context);

    // Optionally write to file for persistent logging
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, jsonLog + '\n', 'utf-8');
      } catch (err) {
        console.error('Failed to write to log file:', err);
      }
    }
  }

  debug(message: string, meta?: any) {
    this.writeLog(this.formatEntry('DEBUG', message, meta));
  }

  info(message: string, meta?: any) {
    this.writeLog(this.formatEntry('INFO', message, meta));
  }

  warn(message: string, meta?: any) {
    this.writeLog(this.formatEntry('WARN', message, meta));
  }

  error(message: string, meta?: any) {
    this.writeLog(this.formatEntry('ERROR', message, meta));
  }

  critical(message: string, meta?: any) {
    this.writeLog(this.formatEntry('CRITICAL', message, meta));
  }

  withContext(context: LogContext): StructuredLogger {
    return new StructuredLogger(this.service, { ...this.context, ...context }, this.logFile);
  }
}

export function createStructuredLogger(service: string, context?: LogContext): StructuredLogger {
  const logFile = process.env.LOG_FILE_PATH 
    ? path.join(process.env.LOG_FILE_PATH, `${service}-${new Date().toISOString().split('T')[0]}.jsonl`)
    : undefined;
  return new StructuredLogger(service, context, logFile);
}
