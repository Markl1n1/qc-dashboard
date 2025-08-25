
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'OFF';

interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  setLevel: (level: LogLevel) => void;
  getLevel: () => LogLevel;
}

class ConsoleLogger implements Logger {
  private level: LogLevel = 'ERROR'; // Default to only show errors
  private readonly levels = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    OFF: 4
  };

  constructor() {
    // Check if we're in development mode
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    this.level = isDev ? 'WARN' : 'ERROR';
  }

  setLevel(level: LogLevel): void {
    this.level = level;
    localStorage.setItem('app-log-level', level);
  }

  getLevel(): LogLevel {
    const stored = localStorage.getItem('app-log-level') as LogLevel;
    return stored || this.level;
  }

  private shouldLog(level: LogLevel): boolean {
    const currentLevel = this.getLevel();
    return this.levels[level] >= this.levels[currentLevel];
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('DEBUG')) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('INFO')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('WARN')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('ERROR')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

export const logger = new ConsoleLogger();
export type { LogLevel };
