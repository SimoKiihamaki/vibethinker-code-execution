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
 * Parse .env file content
 */
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }

  return env;
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
    if (env.temperature) config.mlx!.temperature = parseFloat(env.temperature);
    if (env.top_p) config.mlx!.topP = parseFloat(env.top_p);
    if (env.top_k) config.mlx!.topK = parseInt(env.top_k, 10);
    if (env.repetition_penalty) config.mlx!.repetitionPenalty = parseFloat(env.repetition_penalty);
    if (env.presence_penalty) config.mlx!.presencePenalty = parseFloat(env.presence_penalty);
    if (env.greedy) config.mlx!.greedy = env.greedy === 'true';
    if (env.out_seq_length) config.mlx!.outSeqLength = parseInt(env.out_seq_length, 10);

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
        level: json.monitoring.logging_level?.toLowerCase(),
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
