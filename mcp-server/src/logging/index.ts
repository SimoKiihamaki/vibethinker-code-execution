/**
 * Unified Logger Factory
 *
 * Provides consistent logging across all components with:
 * - Component-based labeling
 * - Configurable log levels
 * - Pretty or JSON output formats
 */
import winston from 'winston';
import chalk from 'chalk';
import { getConfig, type LoggingConfig } from '../config/index.js';

// Cache loggers by component name
const loggerCache = new Map<string, winston.Logger>();

/**
 * Create a pretty formatter for console output
 */
function createPrettyFormat(component: string) {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const componentLabel = chalk.magenta(`[${component}]`);
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${chalk.gray(timestamp)} ${componentLabel} ${level} ${message}${metaStr}`;
    })
  );
}

/**
 * Create a JSON formatter for structured logging
 */
function createJsonFormat(component: string) {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format((info) => {
      info.component = component;
      return info;
    })()
  );
}

interface CreateLoggerOptions {
  component: string;
  level?: LoggingConfig['level'];
  format?: LoggingConfig['format'];
}

/**
 * Create a logger for a specific component
 */
export function createLogger(options: CreateLoggerOptions): winston.Logger {
  const { component, level: overrideLevel, format: overrideFormat } = options;

  // Return cached logger if exists
  if (loggerCache.has(component) && !overrideLevel && !overrideFormat) {
    return loggerCache.get(component)!;
  }

  // Get config (may fail if config not loaded yet, use defaults)
  let config: LoggingConfig;
  try {
    config = getConfig().logging;
  } catch {
    config = { level: 'info', format: 'pretty', logRequests: true, logResponses: false };
  }

  const level = overrideLevel || config.level;
  const format = overrideFormat || config.format;

  const formatFn = format === 'json'
    ? createJsonFormat(component)
    : createPrettyFormat(component);

  const logger = winston.createLogger({
    level,
    format: formatFn,
    transports: [
      new winston.transports.Console({
        stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'],
      }),
    ],
  });

  // Cache the logger
  loggerCache.set(component, logger);

  return logger;
}

/**
 * Get all registered loggers
 */
export function getLoggers(): Map<string, winston.Logger> {
  return new Map(loggerCache);
}

/**
 * Clear logger cache (useful for testing)
 */
export function clearLoggers(): void {
  loggerCache.clear();
}

/**
 * Update log level for all loggers
 */
export function setLogLevel(level: LoggingConfig['level']): void {
  for (const logger of loggerCache.values()) {
    logger.level = level;
  }
}
