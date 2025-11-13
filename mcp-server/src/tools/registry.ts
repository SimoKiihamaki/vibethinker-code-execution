import { z } from 'zod';
import winston from 'winston';
import chalk from 'chalk';
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
  transports: [new winston.transports.Console()],
});

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  inputSchema: z.ZodObject<any>;
  handler: (args: any) => Promise<any>;
  tags: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  dependencies: string[];
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private categories: Map<string, ToolDefinition[]> = new Map();

  constructor() {
    this.initializeTools();
  }

  private async initializeTools(): Promise<void> {
    logger.info('Initializing tool registry...');
    
    // Register core tools
    await this.registerRepoSearchTools();
    await this.registerCodeAnalysisTools();
    await this.registerArchitecturalTools();
    await this.registerContextBuildingTools();
    
    logger.info(chalk.green(`✅ Registered ${this.tools.size} tools across ${this.categories.size} categories`));
  }

  private async registerRepoSearchTools(): Promise<void> {
    const category = 'repo-search';
    const tools: ToolDefinition[] = [
      {
        name: 'searchByQuery',
        description: 'Search repository by natural language query using ripgrep and semantic understanding',
        category,
        inputSchema: z.object({
          query: z.string().describe('Natural language search query'),
          fileTypes: z.array(z.string()).optional().describe('File extensions to search (e.g., [".ts", ".tsx"])'),
          maxResults: z.number().int().min(1).max(100).default(20).describe('Maximum number of results'),
          contextLines: z.number().int().min(0).max(10).default(3).describe('Lines of context around matches'),
        }),
        handler: async (args) => {
          // Implementation would use ripgrep and MLX for semantic search
          return {
            results: [],
            query: args.query,
            executionTime: Date.now(),
          };
        },
        tags: ['search', 'ripgrep', 'semantic'],
        complexity: 'moderate',
        dependencies: ['ripgrep', 'mlx'],
      },
      {
        name: 'findDependencies',
        description: 'Find all dependencies and imports for a given file or module',
        category,
        inputSchema: z.object({
          filePath: z.string().describe('Path to the file to analyze'),
          depth: z.number().int().min(1).max(5).default(2).describe('Dependency depth to traverse'),
          includeExternal: z.boolean().default(false).describe('Include external npm packages'),
        }),
        handler: async (args) => {
          // Implementation would build dependency graph
          return {
            dependencies: [],
            filePath: args.filePath,
            depth: args.depth,
          };
        },
        tags: ['dependencies', 'imports', 'graph'],
        complexity: 'complex',
        dependencies: ['ast-grep', 'import-resolver'],
      },
      {
        name: 'analyzeImports',
        description: 'Analyze import patterns and circular dependencies',
        category,
        inputSchema: z.object({
          directory: z.string().describe('Directory to analyze'),
          detectCycles: z.boolean().default(true).describe('Detect circular dependencies'),
          analyzePatterns: z.boolean().default(true).describe('Analyze import patterns'),
        }),
        handler: async (args) => {
          // Implementation would analyze import patterns
          return {
            imports: [],
            cycles: [],
            patterns: {},
            directory: args.directory,
          };
        },
        tags: ['imports', 'cycles', 'patterns'],
        complexity: 'complex',
        dependencies: ['ast-grep', 'dependency-analyzer'],
      },
      {
        name: 'buildGraph',
        description: 'Build comprehensive dependency graph of the repository',
        category,
        inputSchema: z.object({
          rootPath: z.string().describe('Root path of the repository'),
          includeTypes: z.array(z.string()).optional().describe('File types to include'),
          excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude'),
        }),
        handler: async (args) => {
          // Implementation would build complete dependency graph
          return {
            graph: {},
            nodes: [],
            edges: [],
            rootPath: args.rootPath,
          };
        },
        tags: ['graph', 'dependencies', 'visualization'],
        complexity: 'complex',
        dependencies: ['graph-builder', 'dependency-analyzer'],
      },
    ];

    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  private async registerCodeAnalysisTools(): Promise<void> {
    const category = 'code-analysis';
    const tools: ToolDefinition[] = [
      {
        name: 'analyzeFile',
        description: 'Deep analysis of a single file including complexity, patterns, and issues',
        category,
        inputSchema: z.object({
          filePath: z.string().describe('Path to the file to analyze'),
          analysisType: z.enum(['full', 'complexity', 'patterns', 'issues']).default('full'),
          includeSuggestions: z.boolean().default(true).describe('Include improvement suggestions'),
        }),
        handler: async (args) => {
          // Implementation would analyze file
          return {
            analysis: {},
            filePath: args.filePath,
            analysisType: args.analysisType,
          };
        },
        tags: ['analysis', 'file', 'complexity'],
        complexity: 'moderate',
        dependencies: ['ast-grep', 'complexity-analyzer'],
      },
      {
        name: 'analyzeFunction',
        description: 'Analyze specific function or method for complexity and best practices',
        category,
        inputSchema: z.object({
          filePath: z.string().describe('File containing the function'),
          functionName: z.string().describe('Name of the function to analyze'),
          includeCallers: z.boolean().default(false).describe('Include function callers'),
          includeCallees: z.boolean().default(false).describe('Include functions called by this one'),
        }),
        handler: async (args) => {
          // Implementation would analyze function
          return {
            function: {},
            analysis: {},
            filePath: args.filePath,
            functionName: args.functionName,
          };
        },
        tags: ['function', 'analysis', 'complexity'],
        complexity: 'moderate',
        dependencies: ['ast-grep', 'function-analyzer'],
      },
      {
        name: 'findPatterns',
        description: 'Find code patterns, anti-patterns, and best practice violations',
        category,
        inputSchema: z.object({
          directory: z.string().describe('Directory to search'),
          patternTypes: z.array(z.enum(['anti-patterns', 'best-practices', 'security', 'performance'])).default(['anti-patterns']),
          severity: z.enum(['low', 'medium', 'high']).default('medium'),
        }),
        handler: async (args) => {
          // Implementation would find patterns
          return {
            patterns: [],
            violations: [],
            directory: args.directory,
            patternTypes: args.patternTypes,
          };
        },
        tags: ['patterns', 'anti-patterns', 'best-practices'],
        complexity: 'complex',
        dependencies: ['pattern-matcher', 'rule-engine'],
      },
      {
        name: 'detectIssues',
        description: 'Detect potential issues, bugs, and code smells',
        category,
        inputSchema: z.object({
          target: z.string().describe('File or directory to analyze'),
          issueTypes: z.array(z.enum(['bugs', 'code-smells', 'security', 'performance'])).default(['bugs', 'code-smells']),
          confidence: z.enum(['low', 'medium', 'high']).default('medium'),
        }),
        handler: async (args) => {
          // Implementation would detect issues
          return {
            issues: [],
            target: args.target,
            issueTypes: args.issueTypes,
          };
        },
        tags: ['issues', 'bugs', 'code-smells'],
        complexity: 'complex',
        dependencies: ['issue-detector', 'static-analyzer'],
      },
    ];

    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  private async registerArchitecturalTools(): Promise<void> {
    const category = 'architectural';
    const tools: ToolDefinition[] = [
      {
        name: 'synthesizeFindings',
        description: 'Synthesize multiple analysis findings into coherent architectural insights',
        category,
        inputSchema: z.object({
          findings: z.array(z.object({}).passthrough()).describe('Array of analysis findings to synthesize'),
          topic: z.string().describe('Topic or area of focus'),
          depth: z.enum(['overview', 'detailed', 'comprehensive']).default('detailed'),
          includeRecommendations: z.boolean().default(true).describe('Include architectural recommendations'),
        }),
        handler: async (args) => {
          // Implementation would synthesize findings
          return {
            synthesis: {},
            findings: args.findings,
            topic: args.topic,
            depth: args.depth,
          };
        },
        tags: ['synthesis', 'architecture', 'insights'],
        complexity: 'complex',
        dependencies: ['mlx', 'synthesis-engine'],
      },
      {
        name: 'mapArchitecture',
        description: 'Create comprehensive architectural map of the codebase',
        category,
        inputSchema: z.object({
          rootPath: z.string().describe('Root path of the repository'),
          layers: z.array(z.string()).optional().describe('Architectural layers to identify'),
          includeDependencies: z.boolean().default(true).describe('Include dependency mapping'),
        }),
        handler: async (args) => {
          // Implementation would map architecture
          return {
            architecture: {},
            layers: [],
            dependencies: {},
            rootPath: args.rootPath,
          };
        },
        tags: ['architecture', 'mapping', 'layers'],
        complexity: 'complex',
        dependencies: ['architect-analyzer', 'layer-detector'],
      },
      {
        name: 'identifyPatterns',
        description: 'Identify architectural patterns and design principles',
        category,
        inputSchema: z.object({
          codebase: z.string().describe('Path to codebase to analyze'),
          patternTypes: z.array(z.enum(['design-patterns', 'architectural-patterns', 'microservices', 'ddd'])).default(['design-patterns']),
          includeViolations: z.boolean().default(true).describe('Include pattern violations'),
        }),
        handler: async (args) => {
          // Implementation would identify patterns
          return {
            patterns: [],
            violations: [],
            codebase: args.codebase,
            patternTypes: args.patternTypes,
          };
        },
        tags: ['patterns', 'architecture', 'design'],
        complexity: 'complex',
        dependencies: ['pattern-recognizer', 'architect-analyzer'],
      },
    ];

    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  private async registerContextBuildingTools(): Promise<void> {
    const category = 'context-building';
    const tools: ToolDefinition[] = [
      {
        name: 'gatherContext',
        description: 'Gather comprehensive context about code, files, and relationships',
        category,
        inputSchema: z.object({
          target: z.string().describe('File, directory, or pattern to gather context for'),
          contextTypes: z.array(z.enum(['code', 'dependencies', 'documentation', 'history'])).default(['code', 'dependencies']),
          depth: z.enum(['shallow', 'medium', 'deep']).default('medium'),
        }),
        handler: async (args) => {
          // Implementation would gather context
          return {
            context: {},
            target: args.target,
            contextTypes: args.contextTypes,
            depth: args.depth,
          };
        },
        tags: ['context', 'gathering', 'comprehensive'],
        complexity: 'moderate',
        dependencies: ['context-gatherer', 'dependency-analyzer'],
      },
      {
        name: 'summarizeModule',
        description: 'Create concise summary of module functionality and purpose',
        category,
        inputSchema: z.object({
          modulePath: z.string().describe('Path to the module to summarize'),
          summaryType: z.enum(['brief', 'detailed', 'technical']).default('detailed'),
          includeDependencies: z.boolean().default(true).describe('Include dependency summary'),
        }),
        handler: async (args) => {
          // Implementation would summarize module
          return {
            summary: '',
            modulePath: args.modulePath,
            summaryType: args.summaryType,
            dependencies: [],
          };
        },
        tags: ['summary', 'module', 'documentation'],
        complexity: 'moderate',
        dependencies: ['summarizer', 'module-analyzer'],
      },
      {
        name: 'buildDocumentation',
        description: 'Generate comprehensive documentation from code analysis',
        category,
        inputSchema: z.object({
          target: z.string().describe('Target file or directory'),
          docType: z.enum(['api', 'architecture', 'usage', 'comprehensive']).default('comprehensive'),
          includeExamples: z.boolean().default(true).describe('Include code examples'),
        }),
        handler: async (args) => {
          // Implementation would build documentation
          return {
            documentation: '',
            target: args.target,
            docType: args.docType,
            examples: [],
          };
        },
        tags: ['documentation', 'generation', 'comprehensive'],
        complexity: 'complex',
        dependencies: ['doc-generator', 'code-analyzer'],
      },
    ];

    for (const tool of tools) {
      this.registerTool(tool);
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
    const stats = {
      total: this.tools.size,
      categories: this.categories.size,
    };

    for (const [category, tools] of this.categories) {
      stats[`category_${category}`] = tools.length;
    }

    return stats;
  }
}