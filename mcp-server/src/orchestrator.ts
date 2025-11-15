import { z } from 'zod';
import winston from 'winston';
import chalk from 'chalk';
import { MLXClient } from './client.js';
import { ToolRegistry } from './tools/registry.js';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${chalk.gray(timestamp)} ${level} ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'],
    }),
  ],
});

export interface ToolExecution {
  name: string;
  arguments: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    executionTime: number;
    tokensUsed: number;
    cacheHit: boolean;
  };
}

export class Orchestrator {
  private mlxClient: MLXClient;
  private toolRegistry: ToolRegistry;
  private executionCache: Map<string, ToolResult>;
  private contextWindow: Array<{
    role: string;
    content: string;
    timestamp: number;
  }>;

  constructor(mlxClient: MLXClient) {
    this.mlxClient = mlxClient;
    this.toolRegistry = new ToolRegistry();
    this.executionCache = new Map();
    this.contextWindow = [];
  }

  async executeTool(tool: any, args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(tool.name, args);
    
    // Check cache first
    if (this.executionCache.has(cacheKey)) {
      const cached = this.executionCache.get(cacheKey)!;
      logger.debug(`Cache hit for tool: ${chalk.cyan(tool.name)}`);

      return {
        ...cached,
        metadata: {
          executionTime: Date.now() - startTime,
          tokensUsed: cached.metadata?.tokensUsed || 0,
          cacheHit: true,
        },
      };
    }

    try {
      logger.info(`Executing tool: ${chalk.cyan(tool.name)}`);
      
      // Build context for MLX processing
      const context = await this.buildExecutionContext(tool, args);
      
      // Generate optimized prompt for MLX
      const prompt = await this.generateExecutionPrompt(tool, args, context);
      
      // Execute through MLX backend
      const mlxResult = await this.mlxClient.generateCompletion(prompt, {
        temperature: 0.1, // Low temperature for consistent results
        max_tokens: 4096,
      });

      // Parse and validate result
      const result = await this.parseToolResult(tool, mlxResult, args);
      
      // Cache successful results
      if (result.success) {
        this.executionCache.set(cacheKey, result);
      }

      const executionTime = Date.now() - startTime;
      
      logger.info(
        `Tool ${chalk.cyan(tool.name)} completed in ${chalk.green(executionTime + 'ms')}`
      );

      return {
        ...result,
        metadata: {
          executionTime,
          tokensUsed: this.estimateTokens(prompt + mlxResult),
          cacheHit: false,
        },
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error(`Tool ${chalk.cyan(tool.name)} failed:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime,
          tokensUsed: 0,
          cacheHit: false,
        },
      };
    }
  }

  private async buildExecutionContext(
    tool: any,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const context: Record<string, unknown> = {
      toolName: tool.name,
      toolDescription: tool.description,
      arguments: args,
      timestamp: Date.now(),
    };

    // Add relevant context based on tool type
    switch (tool.category) {
      case 'repo-search':
        context.repoStructure = await this.getRepositoryStructure();
        context.recentSearches = this.getRecentContext('search');
        break;
        
      case 'code-analysis':
        context.codebasePatterns = await this.getCodebasePatterns();
        context.analysisHistory = this.getRecentContext('analysis');
        break;
        
      case 'architectural':
        context.architectureMap = await this.getArchitectureMap();
        context.designPatterns = this.getRecentContext('architecture');
        break;
        
      case 'dependency-analysis':
        context.dependencyGraph = await this.getDependencyGraph();
        context.importHistory = this.getRecentContext('imports');
        break;
    }

    return context;
  }

  private async generateExecutionPrompt(
    tool: any,
    args: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<string> {
    const systemPrompt = `You are VibeThinker, an expert code analysis AI. You provide precise, actionable insights about codebases using progressive disclosure patterns.

Key principles:
1. **Progressive Disclosure**: Only reveal what's needed, when it's needed
2. **Context Efficiency**: Minimize tokens while maximizing insight
3. **Actionable Results**: Provide specific, implementable recommendations
4. **Pattern Recognition**: Identify architectural patterns and anti-patterns
5. **Dependency Awareness**: Understand impact of changes across the codebase

Tool: ${tool.name}
Description: ${tool.description}

Context:
${JSON.stringify(context, null, 2)}

Arguments:
${JSON.stringify(args, null, 2)}

Generate a focused, efficient response that:
- Uses minimal tokens while providing maximum insight
- Follows progressive disclosure principles
- Includes actionable recommendations
- Identifies relevant patterns and dependencies
- Provides clear next steps`;

    return systemPrompt;
  }

  private async parseToolResult(
    tool: any,
    mlxResult: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(mlxResult);
      
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          success: true,
          data: parsed,
        };
      }
    } catch {
      // If not valid JSON, treat as text result
    }

    // For text results, structure them appropriately
    return {
      success: true,
      data: {
        result: mlxResult,
        tool: tool.name,
        arguments: args,
        timestamp: Date.now(),
      },
    };
  }

  private generateCacheKey(toolName: string, args: Record<string, unknown>): string {
    const sortedArgs = Object.keys(args)
      .sort()
      .reduce((acc, key) => {
        acc[key] = args[key];
        return acc;
      }, {} as Record<string, unknown>);
    
    return `${toolName}:${JSON.stringify(sortedArgs)}`;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private async getRepositoryStructure(): Promise<Record<string, unknown>> {
    // This would be implemented to scan the actual repository
    return {
      // Implementation would scan and return structure
    };
  }

  private getRecentContext(type: string): Array<Record<string, unknown>> {
    // Filter context window for recent relevant entries
    const cutoff = Date.now() - 3600000; // 1 hour
    return this.contextWindow
      .filter(entry => entry.timestamp > cutoff)
      .filter(entry => entry.content.includes(type))
      .slice(-10) // Last 10 relevant entries
      .map(entry => ({
        role: entry.role,
        content: entry.content,
        timestamp: entry.timestamp,
      }));
  }

  private async getCodebasePatterns(): Promise<Record<string, unknown>> {
    // Analyze codebase for common patterns
    return {
      // Implementation would analyze patterns
    };
  }

  private async getArchitectureMap(): Promise<Record<string, unknown>> {
    // Build architectural map of the codebase
    return {
      // Implementation would map architecture
    };
  }

  private async getDependencyGraph(): Promise<Record<string, unknown>> {
    // Build dependency graph
    return {
      // Implementation would build graph
    };
  }

  addToContext(role: string, content: string): void {
    this.contextWindow.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // Keep context window manageable
    if (this.contextWindow.length > 1000) {
      this.contextWindow = this.contextWindow.slice(-500);
    }
  }

  clearCache(): void {
    this.executionCache.clear();
    logger.info('Execution cache cleared');
  }

  getMetrics() {
    return {
      cacheSize: this.executionCache.size,
      contextWindowSize: this.contextWindow.length,
    };
  }
}