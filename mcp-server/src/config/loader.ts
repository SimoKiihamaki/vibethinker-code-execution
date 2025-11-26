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
 */
function stripQuotes(value: string): string {
  if (value.length < 2) return value;

  const firstChar = value[0];
  const lastChar = value[value.length - 1];

  // Check for matching quotes
  if ((firstChar === '"' && lastChar === '"') || (firstChar === "'" && lastChar === "'")) {
    let unquoted = value.slice(1, -1);

    // Unescape common escape sequences for double-quoted strings
    // Order matters: process character escapes first, then backslash escape last
    // to avoid incorrectly converting literal \\n to newline
    if (firstChar === '"') {
      unquoted = unquoted
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
    // For single-quoted strings, only unescape escaped single quotes and backslashes
    else {
      unquoted = unquoted
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
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
        model: json.mlx_servers.model_path,
        instances: json.mlx_servers.instances,
        basePort: json.mlx_servers.base_port,
        maxTokens: json.mlx_servers.max_tokens,
        temperature: json.mlx_servers.temperature,
        topP: json.mlx_servers.top_p,
        topK: json.mlx_servers.top_k,
        repetitionPenalty: json.mlx_servers.repetition_penalty,
        presencePenalty: json.mlx_servers.presence_penalty,
        greedy: json.mlx_servers.greedy,
        outSeqLength: json.mlx_servers.out_seq_length,
        gpuMemoryFraction: json.mlx_servers.gpu_memory_fraction,
        batchSize: json.mlx_servers.batch_size,
        contextLength: json.mlx_servers.context_length,
      };
    }

    // Map load_balancer config
    if (json.load_balancer) {
      config.loadBalancer = {
        algorithm: json.load_balancer.algorithm,
        healthCheckInterval: json.load_balancer.health_check_interval * 1000,
        healthCheckTimeout: json.load_balancer.health_check_timeout * 1000,
        maxRetries: json.load_balancer.max_retries,
        retryDelay: json.load_balancer.retry_delay,
      };

      if (json.load_balancer.circuit_breaker) {
        config.loadBalancer.circuitBreaker = {
          failureThreshold: json.load_balancer.circuit_breaker.failure_threshold,
          recoveryTimeout: json.load_balancer.circuit_breaker.recovery_timeout,
          halfOpenMaxCalls: json.load_balancer.circuit_breaker.half_open_max_calls,
        };
      }
    }

    // Map performance config
    if (json.performance) {
      config.performance = {
        targetTokensPerSecond: json.performance.target_tokens_per_second,
        maxQueueSize: json.performance.max_queue_size,
        requestTimeout: json.performance.request_timeout,
        keepAlive: json.performance.keep_alive,
        tcpNoDelay: json.performance.tcp_nodelay,
        compression: json.performance.compression,
      };
    }

    // Map monitoring config to logging
    if (json.monitoring) {
      config.logging = {
        level:
          typeof json.monitoring.logging_level === 'string'
            ? json.monitoring.logging_level.toLowerCase()
            : undefined,
        logRequests: json.monitoring.log_requests,
        logResponses: json.monitoring.log_responses,
      };
      config.server = {
        metricsPort: json.monitoring.metrics_port,
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
