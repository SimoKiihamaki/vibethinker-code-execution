/**
 * Centralized Configuration System
 *
 * This module provides a unified configuration interface that:
 * - Loads from multiple sources (.env, config.json, defaults)
 * - Validates all values with Zod schemas
 * - Provides typed access to configuration
 * - Supports environment-specific overrides
 */

export {
  // Schema types
  type AppConfig,
  type MLXServerConfig,
  type LoadBalancerConfig,
  type PerformanceConfig,
  type LoggingConfig,
  type HookConfig,
  type ServerConfig,
  // Schemas for validation
  AppConfigSchema,
  MLXServerConfigSchema,
  LoadBalancerConfigSchema,
  PerformanceConfigSchema,
  LoggingConfigSchema,
  HookConfigSchema,
  ServerConfigSchema,
} from './schema.js';

export { DEFAULT_CONFIG } from './defaults.js';

export { loadConfig, getConfig, resetConfig } from './loader.js';
