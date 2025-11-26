import chalk from 'chalk';
import { ZodError } from 'zod';
import {
  logger,
  ErrorCodes,
  createToolFailure,
  createToolSuccess,
  getRecoveryHint,
  withErrorHandling,
  isToolError,
  inferErrorCode,
  type ErrorCode,
  type StructuredError,
} from './utils.js';
import { ToolDefinition, ToolResult } from './types.js';

/**
 * Custom error class for registry-specific errors
 */
export class ToolRegistryError extends Error {
  public readonly code: ErrorCode;
  public readonly recoveryHint?: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      recoveryHint?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = 'ToolRegistryError';
    this.code = code;
    this.recoveryHint = options?.recoveryHint;
    this.context = options?.context;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, ToolRegistryError);
  }

  toStructuredError(): StructuredError {
    return {
      code: this.code,
      message: this.message,
      recoveryHint: this.recoveryHint,
      context: this.context,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Tool execution metrics for monitoring
 */
interface ToolExecutionMetrics {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  lastExecutionTime?: number;
  lastError?: StructuredError;
}

// Import tool definitions
import * as repoSearch from './definitions/repo-search/index.js';
import * as codeAnalysis from './definitions/code-analysis/index.js';
import * as architectural from './definitions/architectural/index.js';
import * as contextBuilding from './definitions/context-building/index.js';

const isToolDefinition = (value: unknown): value is ToolDefinition => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ToolDefinition>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.category === 'string' &&
    candidate.inputSchema !== undefined &&
    typeof (candidate as any).handler === 'function' &&
    Array.isArray(candidate.tags) &&
    typeof candidate.complexity === 'string' &&
    Array.isArray(candidate.externalDependencies) &&
    Array.isArray(candidate.npmDependencies) &&
    Array.isArray(candidate.internalDependencies)
  );
};

export type { ToolDefinition };

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private categories: Map<string, ToolDefinition[]> = new Map();
  private metrics: Map<string, ToolExecutionMetrics> = new Map();

  constructor() {
    // Synchronous initialization - tools must be registered immediately
    this.initializeTools();
  }

  /**
   * Initialize metrics for a tool
   */
  private initializeMetrics(toolName: string): ToolExecutionMetrics {
    const metrics: ToolExecutionMetrics = {
      totalCalls: 0,
      successCount: 0,
      failureCount: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
    };
    this.metrics.set(toolName, metrics);
    return metrics;
  }

  /**
   * Update metrics after tool execution
   */
  private updateMetrics(
    toolName: string,
    executionTime: number,
    success: boolean,
    error?: StructuredError
  ): void {
    let metrics = this.metrics.get(toolName);
    if (!metrics) {
      metrics = this.initializeMetrics(toolName);
    }

    metrics.totalCalls++;
    metrics.totalExecutionTime += executionTime;
    metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.totalCalls;
    metrics.lastExecutionTime = executionTime;

    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
      if (error) {
        metrics.lastError = error;
      }
    }
  }

  private initializeTools(): void {
    logger.info('Initializing tool registry...');

    // Register tools from each category
    this.registerCategoryTools('repo-search', Object.values(repoSearch));
    this.registerCategoryTools('code-analysis', Object.values(codeAnalysis));
    this.registerCategoryTools('architectural', Object.values(architectural));
    this.registerCategoryTools('context-building', Object.values(contextBuilding));

    logger.info(chalk.green(`✅ Registered ${this.tools.size} tools across ${this.categories.size} categories`));
  }

  private registerCategoryTools(category: string, exports: unknown[]): void {
    for (const candidate of exports) {
      if (!isToolDefinition(candidate)) {
        logger.debug(`Skipping non-tool export from ${category} registry entry`);
        continue;
      }

      if (candidate.category !== category) {
        throw new Error(`Cannot register tool ${candidate.name}: declared category ${candidate.category}, attempted category ${category}`);
      }

      this.registerTool(candidate);
    }
  }

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);

    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, []);
    }

    this.categories.get(tool.category)!.push(tool);

    logger.debug(`Registered tool: ${chalk.cyan(tool.name)} (${tool.category})`);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getToolsByCategory(category: string): ToolDefinition[] {
    return this.categories.get(category) || [];
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  searchTools(query: string): ToolDefinition[] {
    const lowercaseQuery = query.toLowerCase();

    return this.getAllTools().filter(tool =>
      tool.name.toLowerCase().includes(lowercaseQuery) ||
      tool.description.toLowerCase().includes(lowercaseQuery) ||
      tool.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }

  /**
   * Execute a tool with structured error handling and metrics tracking
   */
  async executeTool<T = unknown>(name: string, args: unknown): Promise<ToolResult<T>> {
    const startTime = Date.now();

    // Check if tool exists
    const tool = this.getTool(name);
    if (!tool) {
      const executionTime = Date.now() - startTime;
      const error: StructuredError = {
        code: ErrorCodes.TOOL_NOT_FOUND,
        message: `Tool not found: ${name}`,
        recoveryHint: 'Check the tool name and ensure it is registered. Use getAllTools() to see available tools.',
        context: { requestedTool: name, availableTools: Array.from(this.tools.keys()) },
        timestamp: new Date().toISOString(),
      };

      logger.error(`Tool execution failed: ${error.message}`);
      this.updateMetrics(name, executionTime, false, error);
      return createToolFailure<T>(error.code, error.message, {
        recoveryHint: error.recoveryHint,
        metadata: { executionTime },
      });
    }

    // Validate input arguments
    let validatedArgs: unknown;
    try {
      validatedArgs = tool.inputSchema.parse(args);
    } catch (validationError) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        validationError instanceof ZodError
          ? `Validation failed: ${validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          : `Validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`;

      const error: StructuredError = {
        code: ErrorCodes.TOOL_VALIDATION_ERROR,
        message: errorMessage,
        recoveryHint: 'Review the input parameters and ensure they match the expected schema',
        context: {
          toolName: name,
          providedArgs: args,
          validationErrors: validationError instanceof ZodError ? validationError.errors : undefined,
        },
        timestamp: new Date().toISOString(),
      };

      logger.warn(`Tool ${name} validation failed: ${errorMessage}`);
      this.updateMetrics(name, executionTime, false, error);

      return createToolFailure<T>(error.code, error.message, {
        recoveryHint: error.recoveryHint,
        metadata: { executionTime },
      });
    }

    // Execute tool handler with error handling
    try {
      // validatedArgs is safe to cast - it's been validated by inputSchema.parse()
      const result = await tool.handler(validatedArgs as Record<string, unknown>);
      const executionTime = Date.now() - startTime;

      logger.debug(`Tool ${chalk.cyan(name)} executed successfully in ${executionTime}ms`);
      this.updateMetrics(name, executionTime, true);

      return createToolSuccess<T>(result as T, {
        executionTime,
        toolVersion: tool.version,
      });
    } catch (executionError) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        executionError instanceof Error ? executionError.message : String(executionError);

      // Check if it's already a ToolRegistryError
      if (executionError instanceof ToolRegistryError) {
        this.updateMetrics(name, executionTime, false, executionError.toStructuredError());
        return createToolFailure<T>(executionError.code, executionError.message, {
          recoveryHint: executionError.recoveryHint,
          metadata: { executionTime },
        });
      }

      // Infer error code from error - use TOOL_EXECUTION_ERROR as default for handler errors
      const errorCode = inferErrorCode(executionError, ErrorCodes.TOOL_EXECUTION_ERROR);
      const error: StructuredError = {
        code: errorCode,
        message: errorMessage,
        recoveryHint: getRecoveryHint(errorCode),
        context: { toolName: name, args: validatedArgs },
        timestamp: new Date().toISOString(),
      };

      logger.error(`Tool ${name} execution failed: ${errorMessage}`);
      this.updateMetrics(name, executionTime, false, error);

      return createToolFailure<T>(error.code, error.message, {
        recoveryHint: error.recoveryHint,
        metadata: { executionTime },
      });
    }
  }

  /**
   * Execute a tool and throw on error (for backwards compatibility)
   */
  async executeToolOrThrow<T = unknown>(name: string, args: unknown): Promise<T> {
    const result = await this.executeTool<T>(name, args);

    if (isToolError(result)) {
      // isToolError type guard guarantees result.error exists and is non-null
      const { code, message, recoveryHint } = result.error;
      throw new ToolRegistryError(code as ErrorCode, message, {
        recoveryHint,
      });
    }

    // Explicit check that result is successful and has data
    // The isToolError check above ensures success is true, but TypeScript
    // needs this explicit check to narrow the type properly
    if (!('success' in result) || !result.success || result.data === undefined) {
      throw new ToolRegistryError(
        ErrorCodes.TOOL_EXECUTION_ERROR,
        'Tool execution did not return data as expected.',
      );
    }
    return result.data;
  }

  getToolStats(): Record<string, number> {
    const stats: Record<string, number> = {
      total: this.tools.size,
      categories: this.categories.size,
    };

    for (const [category, tools] of this.categories) {
      stats[`category_${category}`] = tools.length;
    }

    return stats;
  }

  /**
   * Get execution metrics for a specific tool
   */
  getToolMetrics(name: string): ToolExecutionMetrics | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get execution metrics for all tools
   */
  getAllToolMetrics(): Map<string, ToolExecutionMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get aggregated metrics across all tools
   */
  getAggregatedMetrics(): {
    totalCalls: number;
    totalSuccesses: number;
    totalFailures: number;
    successRate: number;
    averageExecutionTime: number;
    toolsWithErrors: string[];
  } {
    let totalCalls = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    let totalExecutionTime = 0;
    const toolsWithErrors: string[] = [];

    for (const [toolName, metrics] of this.metrics) {
      totalCalls += metrics.totalCalls;
      totalSuccesses += metrics.successCount;
      totalFailures += metrics.failureCount;
      totalExecutionTime += metrics.totalExecutionTime;

      if (metrics.lastError) {
        toolsWithErrors.push(toolName);
      }
    }

    return {
      totalCalls,
      totalSuccesses,
      totalFailures,
      successRate: totalCalls > 0 ? totalSuccesses / totalCalls : 1,
      averageExecutionTime: totalCalls > 0 ? totalExecutionTime / totalCalls : 0,
      toolsWithErrors,
    };
  }

  /**
   * Reset metrics for a specific tool or all tools
   */
  resetMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
      logger.debug(`Reset metrics for tool: ${name}`);
    } else {
      this.metrics.clear();
      logger.debug('Reset all tool metrics');
    }
  }

  /**
   * Check if the registry is healthy (no persistent errors)
   */
  isHealthy(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    const aggregated = this.getAggregatedMetrics();

    // Check if any tool has a high failure rate
    for (const [toolName, metrics] of this.metrics) {
      if (metrics.totalCalls > 5) {
        const failureRate = metrics.failureCount / metrics.totalCalls;
        if (failureRate > 0.5) {
          issues.push(
            `Tool ${toolName} has high failure rate: ${(failureRate * 100).toFixed(1)}%`
          );
        }
      }
    }

    // Check overall failure rate
    if (aggregated.totalCalls > 10 && aggregated.successRate < 0.8) {
      issues.push(
        `Overall success rate is low: ${(aggregated.successRate * 100).toFixed(1)}%`
      );
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }
}
