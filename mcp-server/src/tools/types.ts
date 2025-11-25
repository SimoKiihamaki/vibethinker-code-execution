import { z } from 'zod';

/**
 * Resource hints for tool execution
 */
export interface ResourceHints {
  /** Estimated memory usage in MB */
  estimatedMemoryMB?: number;
  /** Estimated execution time in milliseconds */
  estimatedTimeMs?: number;
  /** Whether the tool requires network access */
  requiresNetwork?: boolean;
  /** Whether the tool modifies files */
  modifiesFiles?: boolean;
  /** Whether the tool is CPU-intensive */
  cpuIntensive?: boolean;
}

/**
 * Tool capabilities declaration
 */
export type ToolCapability =
  | 'read-files'
  | 'write-files'
  | 'execute-code'
  | 'network-access'
  | 'mlx-inference'
  | 'ast-parsing'
  | 'dependency-analysis'
  | 'security-scanning'
  | 'metrics-collection'
  | 'pattern-matching'
  | 'search-files';

/**
 * Tool definition interface with extended metadata
 */
export interface ToolDefinition {
  /** Unique tool name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Tool category for organization */
  category: string;

  /** Semantic version of the tool (defaults to '1.0.0' if not specified) */
  version?: string;

  /** Tool author (optional) */
  author?: string;

  /** Tool capabilities */
  capabilities?: ToolCapability[];

  /** Resource usage hints */
  resourceHints?: ResourceHints;

  /** Zod schema for input validation */
  inputSchema: z.ZodObject<z.ZodRawShape>;

  /**
   * Tool execution handler.
   * Accepts validated args from inputSchema and returns a Promise.
   * Uses `any` for backward compatibility with existing tools.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any) => Promise<any>;

  /** Searchable tags */
  tags: string[];

  /** Complexity rating */
  complexity: 'simple' | 'moderate' | 'complex';

  /**
   * External system dependencies required by this tool.
   * These are not npm packages, but represent required capabilities.
   * @example ['ripgrep', 'git', 'ast-grep']
   */
  externalDependencies: string[];

  /**
   * NPM package dependencies required by this tool.
   * @example ['@ast-grep/napi', 'glob']
   */
  npmDependencies: string[];

  /**
   * Internal module dependencies within the codebase.
   * @example ['../../utils.js:validatePath']
   */
  internalDependencies: string[];

  /** Whether the tool is deprecated */
  deprecated?: boolean;

  /** Deprecation message if deprecated */
  deprecationMessage?: string;

  /** Replacement tool name if deprecated */
  replacedBy?: string;
}

/**
 * Result of a tool execution
 */
export interface ToolResult<T = unknown> {
  /** Whether the execution was successful */
  success: boolean;

  /** Result data (if successful) */
  data?: T;

  /** Error information (if failed) */
  error?: {
    code: string;
    message: string;
    recoveryHint?: string;
  };

  /** Execution metadata */
  metadata?: ToolResultMetadata;
}

/**
 * Metadata about tool execution
 */
export interface ToolResultMetadata {
  /** Execution time in milliseconds */
  executionTime: number;

  /** Approximate tokens used */
  tokensUsed?: number;

  /** Whether result came from cache */
  cacheHit?: boolean;

  /** Tool version that executed */
  toolVersion?: string;

  /** Timestamp of execution */
  timestamp?: string;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** Session ID */
  sessionId?: string;

  /** Calling tool (for composition) */
  callingTool?: string;

  /** Request timeout override */
  timeout?: number;

  /** Whether to bypass cache */
  bypassCache?: boolean;
}

/**
 * Type guard to check if an object is a valid ToolDefinition
 */
export function isToolDefinition(obj: unknown): obj is ToolDefinition {
  if (!obj || typeof obj !== 'object') return false;

  const tool = obj as Record<string, unknown>;

  return (
    typeof tool.name === 'string' &&
    typeof tool.description === 'string' &&
    typeof tool.category === 'string' &&
    typeof tool.handler === 'function' &&
    tool.inputSchema !== undefined &&
    Array.isArray(tool.tags)
  );
}
