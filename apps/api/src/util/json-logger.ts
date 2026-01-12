import { LoggerService, LogLevel } from '@nestjs/common';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const levelColors: Record<LogLevel, string> = {
  error: colors.red,
  fatal: colors.red,
  warn: colors.yellow,
  log: colors.green,
  debug: colors.blue,
  verbose: colors.gray,
};

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

    const json = JSON.stringify(logEntry);
    const color = levelColors[level] || colors.reset;
    const levelUpper = level.toUpperCase().padEnd(7);

    // Colorize the output: [LEVEL] timestamp [Context] message
    console.log(
      `${color}${colors.bright}[${levelUpper}]${colors.reset} ` +
      `${colors.dim}${logEntry.timestamp}${colors.reset} ` +
      `${colors.cyan}[${logEntry.context}]${colors.reset} ` +
      `${logEntry.message}${extra?.trace ? `\n${colors.red}${extra.trace}${colors.reset}` : ''}`,
    );
  }
}
