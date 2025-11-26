/**
 * Default configuration values
 */
import type { AppConfig } from './schema.js';

export const DEFAULT_CONFIG: AppConfig = {
  mlx: {
    host: 'localhost',
    port: 8090,
    model: 'lmstudio-community/Qwen3-VL-2B-Thinking-MLX-8bit',
    instances: 27,
    basePort: 8107,
    maxTokens: 32768,
    temperature: 1.0,
    topP: 0.95,
    topK: 20,
    repetitionPenalty: 1.0,
    presencePenalty: 1.5,
    greedy: false,
    outSeqLength: 32768,
    gpuMemoryFraction: 0.85,
    batchSize: 6,
    contextLength: 32768,
  },
  loadBalancer: {
    algorithm: 'least_connections',
    healthCheckInterval: 60000,
    healthCheckTimeout: 60000,
    maxRetries: 3,
    retryDelay: 1000,
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 600000,
      halfOpenMaxCalls: 3,
    },
  },
  performance: {
    targetTokensPerSecond: 55,
    maxQueueSize: 1000,
    requestTimeout: 600000,
    keepAlive: true,
    tcpNoDelay: true,
    compression: true,
    concurrency: 27,
    interval: 1000,
    intervalCap: 100,
  },
  logging: {
    level: 'info',
    format: 'pretty',
    logRequests: true,
    logResponses: false,
  },
  hooks: {
    enabled: true,
    timeout: 30000,
    events: ['SessionStart', 'SessionStop', 'PreToolUse', 'PostToolUse'],
  },
  server: {
    name: 'vibethinker-mcp-server',
    version: '1.0.0',
    metricsPort: 9090,
  },
};
