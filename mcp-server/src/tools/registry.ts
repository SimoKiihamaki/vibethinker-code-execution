import chalk from 'chalk';
import { logger } from './utils.js';
import { ToolDefinition } from './types.js';

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
    Array.isArray(candidate.internalDependencies)
  );
};

export type { ToolDefinition };

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private categories: Map<string, ToolDefinition[]> = new Map();

  constructor() {
    // Synchronous initialization - tools must be registered immediately
    this.initializeTools();
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

  async executeTool(name: string, args: any): Promise<any> {
    const tool = this.getTool(name);

    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Validate input arguments
    const validatedArgs = tool.inputSchema.parse(args);

    // Execute tool handler
    return await tool.handler(validatedArgs);
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
}
