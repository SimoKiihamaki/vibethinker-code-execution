/**
 * Configuration loader - loads and merges config from multiple sources
 */
import * as fs from 'fs';
import * as path from 'path';
import { AppConfigSchema, type AppConfig } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';

interface LoaderOptions {
  envPath?: string;
  configPath?: string;
  cwd?: string;
}

// Deep partial type for intermediate config merging
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: DeepPartial<T>
): T {
  const result = { ...target } as T;

  for (const key in source) {
    const sourceValue = source[key as keyof typeof source];
    const targetValue = target[key as keyof T];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as DeepPartial<Record<string, unknown>>
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Strip surrounding quotes from a value and unescape common sequences
 * Uses a single-pass regex callback to correctly handle all escape sequences
 */
function stripQuotes(value: string): string {
  if (value.length < 2) return value;

  const firstChar = value[0];
  const lastChar = value[value.length - 1];

  // Check for matching quotes
  if ((firstChar === '"' && lastChar === '"') || (firstChar === "'" && lastChar === "'")) {
    let unquoted = value.slice(1, -1);

    // For double-quoted strings, handle all escape sequences in a single pass
    // This prevents issues where \\n would incorrectly become a newline
    if (firstChar === '"') {
      // Use a single regex to handle all escape sequences in one pass
      // The regex only captures the specific characters listed, so all cases are covered
      unquoted = unquoted.replace(/\\(["\\nt])/g, (_match, ch) => {
        switch (ch) {
          case 'n': return '\n';
          case 't': return '\t';
          case '"': return '"';
          case '\\': return '\\';
        }
        // TypeScript exhaustiveness: ch is typed as string, but regex guarantees one of the above
        return ch;
      });
    }
    // For single-quoted strings, only unescape escaped single quotes and backslashes
    else {
      // Use a single regex to handle all escape sequences in one pass
      // The regex only captures the specific characters listed, so all cases are covered
      unquoted = unquoted.replace(/\\(['\\])/g, (_match, ch) => {
        switch (ch) {
          case "'": return "'";
          case '\\': return '\\';
        }
        // TypeScript exhaustiveness: ch is typed as string, but regex guarantees one of the above
        return ch;
      });
    }

    return unquoted;
  }

  return value;
}

/**
 * Parse .env file content
 */
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      let value = valueParts.join('=').trim();
      // Strip surrounding quotes and handle escape sequences
      value = stripQuotes(value);
      env[key.trim()] = value;
    }
  }

  return env;
}

/**
 * Parse a numeric environment variable, returning undefined for invalid input
 */
function parseNumericEnv(
  value: string | undefined,
  parser: (v: string) => number
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parser(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Safely get a numeric value from JSON, returning undefined for non-numeric or NaN values
 */
function safeNumeric(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

/**
 * Safely get a numeric value and multiply by a factor, returning undefined for invalid input
 */
function safeNumericMultiplied(value: unknown, multiplier: number): number | undefined {
  const num = safeNumeric(value);
  return num !== undefined ? num * multiplier : undefined;
}

/**
 * Safely get a boolean value from JSON, returning undefined for non-boolean values
 */
function safeBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Safely get a string value from JSON, returning undefined for non-string values
 */
function safeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Safely get a string value that must be one of allowed values
 */
function safeEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== 'string') return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

/**
 * Load config from .env file
 */
function loadEnvConfig(envPath: string): DeepPartial<AppConfig> {
  try {
    if (!fs.existsSync(envPath)) return {};

    const content = fs.readFileSync(envPath, 'utf-8');
    const env = parseEnvFile(content);

    const config: DeepPartial<AppConfig> = {
      mlx: {},
    };

    // Map env variables to config
    if (env.MODEL_PATH) config.mlx!.model = env.MODEL_PATH;

    const temperature = parseNumericEnv(env.temperature, parseFloat);
    if (temperature !== undefined) config.mlx!.temperature = temperature;

    const topP = parseNumericEnv(env.top_p, parseFloat);
    if (topP !== undefined) config.mlx!.topP = topP;

    const topK = parseNumericEnv(env.top_k, (v) => parseInt(v, 10));
    if (topK !== undefined) config.mlx!.topK = topK;

    const repetitionPenalty = parseNumericEnv(env.repetition_penalty, parseFloat);
    if (repetitionPenalty !== undefined) config.mlx!.repetitionPenalty = repetitionPenalty;

    const presencePenalty = parseNumericEnv(env.presence_penalty, parseFloat);
    if (presencePenalty !== undefined) config.mlx!.presencePenalty = presencePenalty;

    if (env.greedy) config.mlx!.greedy = env.greedy === 'true';

    const outSeqLength = parseNumericEnv(env.out_seq_length, (v) => parseInt(v, 10));
    if (outSeqLength !== undefined) config.mlx!.outSeqLength = outSeqLength;

    return config;
  } catch {
    return {};
  }
}

/**
 * Load config from config.json file
 */
function loadJsonConfig(configPath: string): DeepPartial<AppConfig> {
  try {
    if (!fs.existsSync(configPath)) return {};

    const content = fs.readFileSync(configPath, 'utf-8');
    const json = JSON.parse(content);

    const config: DeepPartial<AppConfig> = {};

    // Map mlx_servers to mlx config
    if (json.mlx_servers) {
      config.mlx = {
        model: safeString(json.mlx_servers.model_path),
        instances: safeNumeric(json.mlx_servers.instances),
        basePort: safeNumeric(json.mlx_servers.base_port),
        maxTokens: safeNumeric(json.mlx_servers.max_tokens),
        temperature: safeNumeric(json.mlx_servers.temperature),
        topP: safeNumeric(json.mlx_servers.top_p),
        topK: safeNumeric(json.mlx_servers.top_k),
        repetitionPenalty: safeNumeric(json.mlx_servers.repetition_penalty),
        presencePenalty: safeNumeric(json.mlx_servers.presence_penalty),
        greedy: safeBoolean(json.mlx_servers.greedy),
        outSeqLength: safeNumeric(json.mlx_servers.out_seq_length),
        gpuMemoryFraction: safeNumeric(json.mlx_servers.gpu_memory_fraction),
        batchSize: safeNumeric(json.mlx_servers.batch_size),
        contextLength: safeNumeric(json.mlx_servers.context_length),
      };
    }

    // Map load_balancer config
    if (json.load_balancer) {
      const lb = json.load_balancer;
      const lbConfig: DeepPartial<AppConfig['loadBalancer']> = {
        algorithm: safeEnum(lb.algorithm, ['least_connections', 'round_robin', 'random'] as const),
        healthCheckInterval: safeNumericMultiplied(lb.health_check_interval, 1000),
        healthCheckTimeout: safeNumericMultiplied(lb.health_check_timeout, 1000),
        maxRetries: safeNumeric(lb.max_retries),
        retryDelay: safeNumeric(lb.retry_delay),
      };

      if (lb.circuit_breaker) {
        lbConfig.circuitBreaker = {
          failureThreshold: safeNumeric(lb.circuit_breaker.failure_threshold),
          recoveryTimeout: safeNumeric(lb.circuit_breaker.recovery_timeout),
          halfOpenMaxCalls: safeNumeric(lb.circuit_breaker.half_open_max_calls),
        };
      }

      config.loadBalancer = lbConfig;
    }

    // Map performance config
    if (json.performance) {
      config.performance = {
        targetTokensPerSecond: safeNumeric(json.performance.target_tokens_per_second),
        maxQueueSize: safeNumeric(json.performance.max_queue_size),
        requestTimeout: safeNumeric(json.performance.request_timeout),
        keepAlive: safeBoolean(json.performance.keep_alive),
        tcpNoDelay: safeBoolean(json.performance.tcp_nodelay),
        compression: safeBoolean(json.performance.compression),
      };
    }

    // Map monitoring config to logging
    if (json.monitoring) {
      const rawLevel = safeString(json.monitoring.logging_level);
      const normalizedLevel = rawLevel ? rawLevel.toLowerCase() : undefined;
      config.logging = {
        level: safeEnum(normalizedLevel, ['error', 'warn', 'info', 'debug', 'verbose', 'silly'] as const),
        logRequests: safeBoolean(json.monitoring.log_requests),
        logResponses: safeBoolean(json.monitoring.log_responses),
      };
      config.server = {
        metricsPort: safeNumeric(json.monitoring.metrics_port),
      };
    }

    return config;
  } catch {
    return {};
  }
}

/**
 * Find config files in standard locations
 */
function findConfigFiles(cwd: string): { envPath?: string; configPath?: string } {
  const possibleEnvPaths = [
    path.resolve(cwd, '.env'),
    path.resolve(cwd, '../.env'),
  ];

  const possibleConfigPaths = [
    path.resolve(cwd, '../mlx-servers/config.json'),
    path.resolve(cwd, 'mlx-servers/config.json'),
    path.resolve(cwd, '../../mlx-servers/config.json'),
  ];

  return {
    envPath: possibleEnvPaths.find(p => fs.existsSync(p)),
    configPath: possibleConfigPaths.find(p => fs.existsSync(p)),
  };
}

/**
 * Load and validate configuration from all sources
 */
export function loadConfig(options: LoaderOptions = {}): AppConfig {
  const cwd = options.cwd || process.cwd();
  const { envPath: foundEnvPath, configPath: foundConfigPath } = findConfigFiles(cwd);

  const envPath = options.envPath || foundEnvPath;
  const configPath = options.configPath || foundConfigPath;

  // Start with defaults
  let config: Record<string, unknown> = { ...DEFAULT_CONFIG };

  // Merge config.json (lower priority)
  if (configPath) {
    const jsonConfig = loadJsonConfig(configPath);
    config = deepMerge(config, jsonConfig as DeepPartial<Record<string, unknown>>);
  }

  // Merge .env file (higher priority)
  if (envPath) {
    const envConfig = loadEnvConfig(envPath);
    config = deepMerge(config, envConfig as DeepPartial<Record<string, unknown>>);
  }

  // Validate final config
  const result = AppConfigSchema.safeParse(config);

  if (!result.success) {
    console.error('Configuration validation failed:', result.error.format());
    throw new Error('Invalid configuration');
  }

  return result.data;
}

/**
 * Get a singleton config instance
 */
let cachedConfig: AppConfig | null = null;

export function getConfig(options?: LoaderOptions): AppConfig {
  if (!cachedConfig || options) {
    cachedConfig = loadConfig(options);
  }
  return cachedConfig;
}

/**
 * Reset cached config (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}
