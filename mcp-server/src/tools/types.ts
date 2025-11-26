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
   *
   * Type safety notes:
   * - Input args are validated by inputSchema BEFORE reaching the handler
   * - The handler receives validated data matching the inputSchema
   * - Returns Promise<unknown> to encourage explicit typing at call sites
   *
   * KNOWN LIMITATION: The generic `z.infer<z.ZodObject<z.ZodRawShape>>` doesn't provide
   * useful type inference for tool implementations. This is because the actual schema
   * type is lost when stored in the ToolDefinition interface. A generic parameter on
   * ToolDefinition (e.g., `ToolDefinition<TSchema extends z.ZodObject<any>>`) would
   * solve this, but adds complexity to the registry system. The workaround below is
   * recommended for type-safe tool implementations.
   *
   * For improved type safety in tool implementations, use z.infer:
   * @example
   * ```ts
   * const inputSchema = z.object({ query: z.string() });
   * type Input = z.infer<typeof inputSchema>;
   * handler: async (args) => {
   *   const { query } = args as Input; // Safe cast after Zod validation
   *   // ...
   * }
   * ```
   */
  handler: (args: z.infer<z.ZodObject<z.ZodRawShape>>) => Promise<unknown>;

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

/**
 * Helper type for creating tool definitions with preserved schema types.
 * This provides better type inference for the handler's args parameter.
 */
export type TypedToolDefinition<TSchema extends z.ZodObject<z.ZodRawShape>> = Omit<
  ToolDefinition,
  'inputSchema' | 'handler'
> & {
  inputSchema: TSchema;
  handler: (args: z.infer<TSchema>) => Promise<unknown>;
};

/**
 * Type-safe helper function for defining tools with preserved schema types.
 *
 * This helper addresses the TypeScript limitation where `z.infer<z.ZodObject<z.ZodRawShape>>`
 * loses specific type information. By using this builder pattern, the schema type is
 * preserved and properly inferred in the handler.
 *
 * @example
 * ```ts
 * const myToolSchema = z.object({
 *   query: z.string(),
 *   maxResults: z.number().optional(),
 * });
 *
 * const myTool = defineToolWithSchema(myToolSchema, {
 *   name: 'myTool',
 *   description: 'My tool description',
 *   category: 'search',
 *   handler: async (args) => {
 *     // args is properly typed as { query: string; maxResults?: number }
 *     const { query, maxResults } = args;
 *     return { results: [] };
 *   },
 *   tags: ['search'],
 *   complexity: 'simple',
 *   externalDependencies: [],
 *   npmDependencies: [],
 *   internalDependencies: [],
 * });
 * ```
 */
export function defineToolWithSchema<TSchema extends z.ZodObject<z.ZodRawShape>>(
  schema: TSchema,
  definition: Omit<TypedToolDefinition<TSchema>, 'inputSchema'>
): ToolDefinition {
  return {
    ...definition,
    inputSchema: schema,
    // Cast handler to the generic form for storage in ToolDefinition
    // The type safety is preserved at the call site via TypedToolDefinition
    handler: definition.handler as ToolDefinition['handler'],
  };
}
