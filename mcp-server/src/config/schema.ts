/**
 * Configuration schemas using Zod for validation
 */
import { z } from 'zod';

// MLX Server configuration schema
export const MLXServerConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().int().min(1024).max(65535).default(8090),
  model: z.string().default('lmstudio-community/Qwen3-VL-2B-Thinking-MLX-8bit'),
  instances: z.number().int().min(1).max(100).default(27),
  basePort: z.number().int().min(1024).max(65535).default(8107),
  maxTokens: z.number().int().min(1).max(32768).default(32768),
  temperature: z.number().min(0).max(2).default(1.0),
  topP: z.number().min(0).max(1).default(0.95),
  topK: z.number().int().min(1).max(100).default(20),
  repetitionPenalty: z.number().min(0).max(2).default(1.0),
  presencePenalty: z.number().min(-2).max(2).default(1.5),
  greedy: z.boolean().default(false),
  outSeqLength: z.number().int().min(1).max(32768).default(32768),
  gpuMemoryFraction: z.number().min(0).max(1).default(0.85),
  batchSize: z.number().int().min(1).max(32).default(6),
  contextLength: z.number().int().min(1).max(131072).default(32768),
});

// Load balancer configuration schema
export const LoadBalancerConfigSchema = z.object({
  algorithm: z.enum(['least_connections', 'round_robin', 'random']).default('least_connections'),
  healthCheckInterval: z.number().int().min(1000).default(60000),
  healthCheckTimeout: z.number().int().min(1000).default(60000),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().int().min(100).default(1000),
  circuitBreaker: z.object({
    failureThreshold: z.number().int().min(1).default(5),
    recoveryTimeout: z.number().int().min(1000).default(600000),
    halfOpenMaxCalls: z.number().int().min(1).default(3),
  }).default({}),
});

// Performance configuration schema
export const PerformanceConfigSchema = z.object({
  targetTokensPerSecond: z.number().min(1).default(55),
  maxQueueSize: z.number().int().min(1).default(1000),
  requestTimeout: z.number().int().min(1000).default(600000),
  keepAlive: z.boolean().default(true),
  tcpNoDelay: z.boolean().default(true),
  compression: z.boolean().default(true),
  concurrency: z.number().int().min(1).max(100).default(27),
  interval: z.number().int().min(100).default(1000),
  intervalCap: z.number().int().min(1).default(100),
});

// Logging configuration schema
export const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'verbose', 'silly']).default('info'),
  format: z.enum(['json', 'pretty']).default('pretty'),
  logRequests: z.boolean().default(true),
  logResponses: z.boolean().default(false),
});

// Hook configuration schema
export const HookConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timeout: z.number().int().min(1000).default(30000),
  events: z.array(z.enum([
    'SessionStart',
    'SessionStop',
    'PreToolUse',
    'PostToolUse',
    'Notification',
    'Stop',
    'PreToolResponse',
    'PostToolResponse',
  ])).default(['SessionStart', 'SessionStop', 'PreToolUse', 'PostToolUse']),
});

// Server configuration schema
export const ServerConfigSchema = z.object({
  name: z.string().default('vibethinker-mcp-server'),
  version: z.string().default('1.0.0'),
  healthPort: z.number().int().min(1024).max(65535).optional(),
  metricsPort: z.number().int().min(1024).max(65535).default(9090),
});

// Main application configuration schema
export const AppConfigSchema = z.object({
  mlx: MLXServerConfigSchema.default({}),
  loadBalancer: LoadBalancerConfigSchema.default({}),
  performance: PerformanceConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
  hooks: HookConfigSchema.default({}),
  server: ServerConfigSchema.default({}),
});

// Type exports
export type MLXServerConfig = z.infer<typeof MLXServerConfigSchema>;
export type LoadBalancerConfig = z.infer<typeof LoadBalancerConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type HookConfig = z.infer<typeof HookConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
