type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
}
const RESET = '\x1b[0m'

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

/**
 * Minimum level that is printed. Production builds skip `debug`; set
 * `localStorage.qmLogLevel = 'debug'` to turn it back on for a support case.
 */
function resolveMinLevel(): LogLevel {
  try {
    const override = typeof localStorage !== 'undefined' ? localStorage.getItem('qmLogLevel') : null
    if (override && override in LEVEL_RANK) return override as LogLevel
  } catch {
    // localStorage unavailable (worker, tests)
  }
  return import.meta.env?.PROD ? 'info' : 'debug'
}

let minLevel: LogLevel = resolveMinLevel()

export function setLogLevel(level: LogLevel): void {
  minLevel = level
}

class Logger {
  private tag: string

  constructor(tag: string) {
    this.tag = tag
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return
    const timestamp = new Date().toISOString()
    const color = LOG_COLORS[level]
    const prefix = `${color}[${level.toUpperCase()}]${RESET} [${this.tag}]`

    if (data !== undefined) {
      console[level](`${timestamp} ${prefix} ${message}`, data)
    } else {
      console[level](`${timestamp} ${prefix} ${message}`)
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data)
  }
}

/** Create a logger with a tag (e.g., "AudioCapture", "AIService") */
export function createLogger(tag: string): Logger {
  return new Logger(tag)
}
