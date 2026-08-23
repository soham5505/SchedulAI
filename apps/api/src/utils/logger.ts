type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, meta?: unknown) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]:`;
    if (level === 'error') {
      console.error(prefix, message, meta !== undefined ? meta : '');
    } else if (level === 'warn') {
      console.warn(prefix, message, meta !== undefined ? meta : '');
    } else {
      console.log(prefix, message, meta !== undefined ? meta : '');
    }
  }

  info(message: string, meta?: unknown) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: unknown) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: unknown) {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, meta);
    }
  }
}
