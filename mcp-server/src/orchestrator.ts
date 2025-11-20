import { z } from 'zod';
import winston from 'winston';
import chalk from 'chalk';
import { MLXClient } from './client.js';
import { ToolRegistry } from './tools/registry.js';
import fs from 'fs/promises';
import path from 'path';

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
        temperature: 0.1,
        max_tokens: tool.category === 'repo-search' || tool.category === 'code-analysis' ? 1024 : 2048,
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
    const systemPrompt = `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: ${tool.name}
Description: ${tool.description}

Context:
${JSON.stringify(context, null, 2)}

Arguments:
${JSON.stringify(args, null, 2)}

Output requirements:
- Provide precise, actionable insights
- Include specific recommendations and clear next steps
- Identify relevant patterns and dependencies
- Minimize tokens while maximizing clarity`;

    return systemPrompt;
  }

  private async parseToolResult(
    tool: any,
    mlxResult: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const preprocessedForJson = this.sanitizeOutput(mlxResult, 'json');
    const extractedJson = this.extractFirstJson(preprocessedForJson);
    if (extractedJson) {
      try {
        const parsed = JSON.parse(extractedJson);
        if (typeof parsed === 'object' && parsed !== null) {
          return {
            success: true,
            data: parsed,
          };
        }
      } catch (err) {
        logger.debug(`Failed to parse JSON from tool result: ${err}. Extracted JSON: ${extractedJson}`);
      }
    }

    const textResult = this.sanitizeOutput(mlxResult, 'text');
    return {
      success: true,
      data: {
        result: textResult,
        tool: tool.name,
        arguments: args,
        timestamp: Date.now(),
      },
    };
  }

  private sanitizeOutput(text: string, mode: 'json' | 'text'): string {
    let t = text;
    t = t.replace(/^[\s`]+|[\s`]+$/g, '');
    t = t.replace(/```[\s\S]*?```/g, s => s.replace(/```/g, ''));
    t = t
      .split(/\n/)
      .filter(line =>
        !/for the user/i.test(line) &&
        !/your response should/i.test(line) &&
        !/^\s*your task:/i.test(line) &&
        !/^\s*output format:/i.test(line) &&
        !/^\s*output example:/i.test(line)
      )
      .join('\n');
    t = t.replace(/\b(Wait|Hmm|Let me think|Thinking)[:,]?\b/gi, '');
    t = t.replace(/[\t\r]+/g, ' ');
    t = t.replace(/\s{2,}/g, ' ').trim();
    if (mode === 'text') {
      const words = t.split(/\s+/);
      if (words.length > 180) {
        t = words.slice(0, 180).join(' ');
      }
    }
    return t;
  }

  private extractFirstJson(text: string): string | null {
    const startIdx = text.search(/[\{\[]/);
    if (startIdx === -1) return null;
    const isArray = text[startIdx] === '[';
    const open = isArray ? '[' : '{';
    const close = isArray ? ']' : '}';
    let depth = 0;
    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i];
      if (ch === open) depth++;
      else if (ch === close) depth--;
      if (depth === 0) {
        const candidate = text.slice(startIdx, i + 1).trim();
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          // continue searching for next JSON block
          const nextStart = text.slice(i + 1).search(/[\{\[]/);
          if (nextStart === -1) return null;
          return this.extractFirstJson(text.slice(i + 1 + nextStart));
        }
      }
    }
    return null;
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
    const root = process.cwd();
    const structure: Record<string, any> = {};

    async function scan(dir: string, node: any, depth: number) {
      if (depth > 3) return; // Limit depth
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;

          if (e.isDirectory()) {
            node[e.name] = {};
            await scan(path.join(dir, e.name), node[e.name], depth + 1);
          } else {
            node[e.name] = 'file';
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }

    await scan(root, structure, 0);
    return structure;
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
      try {
        // Reuse the identifyPatterns tool logic
        return await this.toolRegistry.executeTool('identifyPatterns', {
          codebase: process.cwd(),
          patternTypes: ['architectural', 'design']
        });
      } catch (e) {
        logger.warn('Failed to get codebase patterns', e);
        return {
          _error: 'getCodebasePatterns',
          _message: e instanceof Error ? e.message : String(e),
          _stack: e instanceof Error ? e.stack : undefined,
        };
      }
    }

  private async getArchitectureMap(): Promise<Record<string, unknown>> {
    try {
      // Reuse mapArchitecture tool if available, or fallback to basic structure
      // Since mapArchitecture wasn't explicitly in the "missing" list, we assume it exists or we use a placeholder that tries to call it.
      // If it fails (e.g. not implemented), we return a basic map.
      return await this.toolRegistry.executeTool('mapArchitecture', {
        target: process.cwd(),
        depth: 'high'
      });
      } catch (e) {
        // Fallback: return structure as a proxy for architecture
        return {
          structure: await this.getRepositoryStructure(),
          _error: 'getArchitectureMap',
          _message: e instanceof Error ? e.message : String(e),
          _stack: e instanceof Error ? e.stack : undefined,
        };
      }
    }

  private async getDependencyGraph(): Promise<Record<string, unknown>> {
    try {
      return await this.toolRegistry.executeTool('buildGraph', {
        path: process.cwd(),
        depth: 2
      });
      } catch (e) {
        return {
          error: 'Failed to build dependency graph',
          _error: 'getDependencyGraph',
          _message: e instanceof Error ? e.message : String(e),
          _stack: e instanceof Error ? e.stack : undefined,
        };
      }
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
