import { LoggerService, LogLevel } from '@nestjs/common';

export class JsonLogger implements LoggerService {
  private logLevels: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose'];

  setLogLevels(levels: LogLevel[]) {
    this.logLevels = levels;
  }

  log(message: any, context?: string) {
    if (this.logLevels.includes('log')) {
      this.write('log', message, context);
    }
  }

  error(message: any, trace?: string, context?: string) {
    if (this.logLevels.includes('error')) {
      this.write('error', message, context, { trace });
    }
  }

  warn(message: any, context?: string) {
    if (this.logLevels.includes('warn')) {
      this.write('warn', message, context);
    }
  }

  debug(message: any, context?: string) {
    if (this.logLevels.includes('debug')) {
      this.write('debug', message, context);
    }
  }

  verbose(message: any, context?: string) {
    if (this.logLevels.includes('verbose')) {
      this.write('verbose', message, context);
    }
  }

  private write(level: LogLevel, message: any, context?: string, extra?: Record<string, any>) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: context || 'Application',
      message: typeof message === 'string' ? message : JSON.stringify(message),
      ...extra,
    };

    console.log(JSON.stringify(logEntry));
  }
}
