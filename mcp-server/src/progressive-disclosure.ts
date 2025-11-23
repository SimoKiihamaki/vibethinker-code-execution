import { z } from 'zod';
import winston from 'winston';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
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

export interface GeneratedTool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  category: string;
  complexity: 'simple' | 'moderate' | 'complex';
  tags: string[];
}

export class ProgressiveDisclosureGenerator {
  private toolRegistry: ToolRegistry;
  private apiPath: string;
  private cache: Map<string, GeneratedTool>;

  constructor() {
    this.toolRegistry = new ToolRegistry();
    this.apiPath = path.join(process.cwd(), 'servers');
    this.cache = new Map();
  }

  async generateAPI(): Promise<void> {
    logger.info('Generating progressive disclosure API...');

    // Ensure servers directory exists
    await fs.mkdir(this.apiPath, { recursive: true });

    // Generate API structure for each category
    const categories = this.toolRegistry.getCategories();

    for (const category of categories) {
      await this.generateCategoryAPI(category);
    }

    // Generate main index file
    const mainIndexContent = this.buildMainIndexContent(categories);
    await this.writeFileIfChanged(path.join(this.apiPath, 'index.ts'), mainIndexContent);

    logger.info(chalk.green('✅ Progressive disclosure API generated'));
  }

  async generateTools(): Promise<GeneratedTool[]> {
    const tools = this.toolRegistry.getAllTools();

    logger.info(`Generating ${tools.length} tools from registry`);

    const generatedTools = tools.map(tool => {
      logger.debug(`Generating tool: ${tool.name} (${tool.category})`);

      return {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        category: tool.category,
        complexity: tool.complexity,
        tags: tool.tags,
      };
    });

    logger.info(`Successfully generated ${generatedTools.length} tools`);
    return generatedTools;
  }

  async loadTool(name: string): Promise<GeneratedTool | null> {
    logger.debug(`Loading tool: ${name}`);

    // Check cache first
    if (this.cache.has(name)) {
      logger.debug(`Tool ${name} found in cache`);
      return this.cache.get(name)!;
    }

    const tool = this.toolRegistry.getTool(name);

    if (!tool) {
      logger.warn(`Tool not found in registry: ${name}`);
      return null;
    }

    logger.debug(`Tool found in registry: ${name}, creating generated tool`);

    const generatedTool: GeneratedTool = {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      category: tool.category,
      complexity: tool.complexity,
      tags: tool.tags,
    };

    // Cache for future use
    this.cache.set(name, generatedTool);
    logger.debug(`Tool ${name} cached successfully`);

    return generatedTool;
  }

  private async writeFileIfChanged(filePath: string, content: string): Promise<boolean> {
    const SMALL_FILE_THRESHOLD = 128 * 1024;
    let existingContent: string | null = null;
    try {
      existingContent = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code && err.code !== 'ENOENT') {
        throw err;
      }
    }

    if (existingContent !== null) {
      const bothSmall = existingContent.length <= SMALL_FILE_THRESHOLD && content.length <= SMALL_FILE_THRESHOLD;
      if (bothSmall && existingContent === content) {
        logger.debug(`File ${path.basename(filePath)} unchanged (direct compare), skipping write`);
        return false;
      }
      if (!bothSmall) {
        const existingHash = crypto.createHash('sha256').update(existingContent).digest('hex');
        const newHash = crypto.createHash('sha256').update(content).digest('hex');
        if (existingHash === newHash) {
          logger.debug(`File ${path.basename(filePath)} unchanged (hash compare), skipping write`);
          return false;
        }
      }
    }

    const dir = path.dirname(filePath);
    const randomPart = crypto.randomBytes(6).toString('hex');
    const tempFile = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${randomPart}.tmp`);
    await fs.mkdir(dir, { recursive: true });

    try {
      await fs.writeFile(tempFile, content, 'utf8');
      await fs.rename(tempFile, filePath);
    } catch (error) {
      try {
        await fs.rm(tempFile, { force: true });
      } catch {
        // ignore cleanup errors
      }
      throw error;
    }

    return true;
  }

  private async generateCategoryAPI(category: string): Promise<void> {
    const categoryPath = path.join(this.apiPath, category);
    await fs.mkdir(categoryPath, { recursive: true });

    const tools = this.toolRegistry.getToolsByCategory(category);

    // Generate index.ts for category
    const indexContent = this.generateCategoryIndex(category, tools);
    await this.writeFileIfChanged(path.join(categoryPath, 'index.ts'), indexContent);

    // Generate individual tool files
    for (const tool of tools) {
      const toolContent = this.generateToolFile(tool);
      await this.writeFileIfChanged(path.join(categoryPath, `${tool.name}.ts`), toolContent);
    }

    logger.debug(`Generated ${tools.length} tools for category: ${chalk.cyan(category)}`);
  }

  private generateCategoryIndex(category: string, tools: any[]): string {
    const imports = tools.map(tool =>
      `import { ${tool.name} } from './${tool.name}.js';`
    ).join('\n');

    const exports = tools.map(tool =>
      `  ${tool.name},`
    ).join('\n');

    return `${imports}

// ${category} tools for progressive disclosure
export {
${exports}
};

// Category metadata
export const category = {
  name: '${category}',
  description: 'Tools for ${category.replace('-', ' ')}',
  tools: [${tools.map(tool => `'${tool.name}'`).join(', ')}],
  complexity: '${tools.some(t => t.complexity === 'complex') ? 'complex' : tools.some(t => t.complexity === 'moderate') ? 'moderate' : 'simple'}',
};
`;
  }

  private generateToolFile(tool: any): string {
    return `import { z } from 'zod';
import { estimateTokens, getMLXClient } from '../../../servers/shared/utils.js';

/**
 * ${tool.description}
 * 
 * Category: ${tool.category}
 * Complexity: ${tool.complexity}
 * Tags: ${tool.tags.join(', ')}
 */

const ${tool.name}Schema = ${this.generateZodSchema(tool.inputSchema)};

export interface ${tool.name}Input extends z.infer<typeof ${tool.name}Schema> {}

export interface ${tool.name}Result {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    tokensUsed: number;
    cacheHit: boolean;
  };
}

/**
 * Execute ${tool.name} tool with progressive disclosure
 */
export async function ${tool.name}(input: ${tool.name}Input): Promise<${tool.name}Result> {
  // Validate input
  const validatedInput = ${tool.name}Schema.parse(input);
  
  // Get MLX client instance
  const mlxClient = await getMLXClient();
  
  // Build context-aware prompt
  const prompt = build${tool.name}Prompt(validatedInput);
  
  // Execute through MLX backend
  const startTime = Date.now();
  
  try {
    const result = await mlxClient.generateCompletion(prompt, {
      temperature: 0.1,
      max_tokens: 4096,
    });
    
    const executionTime = Date.now() - startTime;
    
    return {
      success: true,
      data: parse${tool.name}Result(result, validatedInput),
      metadata: {
        executionTime,
        tokensUsed: estimateTokens(prompt + result),
        cacheHit: false,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        executionTime: Date.now() - startTime,
        tokensUsed: 0,
        cacheHit: false,
      },
    };
  }
}

/**
 * Build context-aware prompt for ${tool.name}
 */
function build${tool.name}Prompt(input: ${tool.name}Input): string {
  return \`You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: ${tool.name}
Description: ${tool.description}
Category: ${tool.category}
Complexity: ${tool.complexity}

Input:
\${JSON.stringify(input, null, 2)}

Output requirements:
- Provide precise, actionable insights
- Include specific recommendations and clear next steps
- Identify relevant patterns and dependencies
- Minimize tokens while maximizing clarity\`;
}

/**
 * Parse and structure ${tool.name} results
 */
function parse${tool.name}Result(result: string, input: ${tool.name}Input): any {
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(result);
    return parsed;
  } catch {
    // If not JSON, return structured text result
    return {
      result: result,
      input: input,
      timestamp: Date.now(),
    };
  }
}

/**
 * Estimate token count for text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
`;
  }

  private buildMainIndexContent(categories: string[]): string {
    const imports = categories.map(category =>
      `import * as ${category.replace('-', '')} from './${category}/index.js';`
    ).join('\n');

    const exports = categories.map(category =>
      `  ${category.replace('-', '')},`
    ).join('\n');

    const categoriesMetadata = categories.map(category =>
      `    {
      name: '${category}',
      path: './${category}',
      complexity: '${this.getCategoryComplexity(category)}',
    }`
    ).join(',\n');

    return `${imports}

/**
 * Progressive Disclosure API for VibeThinker
 * 
 * This API provides tools for repository analysis with progressive disclosure,
 * allowing Claude to load only what's needed, when it's needed.
 * 
 * Benefits:
 * - 98.7% token reduction (150k → 2k tokens)
 * - On-demand tool loading
 * - Context-aware execution
 * - MLX-accelerated processing
 */

export {
${exports}
};

// API metadata
export const api = {
  version: '1.0.0',
  categories: [
${categoriesMetadata}
  ],
  totalTools: ${this.toolRegistry.getAllTools().length},
  features: [
    'progressive-disclosure',
    'context-aware-execution',
    'mlx-acceleration',
    'intelligent-caching',
    'dependency-tracking',
  ],
};

// Helper function to discover tools
export function discoverTools(query?: string) {
  const allTools = [
    ${this.toolRegistry.getAllTools().map(t => `{
      name: '${t.name}',
      description: '${t.description.replace(/'/g, "\\'")}',
      category: '${t.category}',
      tags: [${t.tags.map(tag => `'${tag}'`).join(', ')}]
    }`).join(',\n    ')}
  ];
  
  if (!query) {
    return allTools;
  }
  
  const lowerQuery = query.toLowerCase();
  return allTools.filter(tool => 
    tool.name.toLowerCase().includes(lowerQuery) || 
    tool.description.toLowerCase().includes(lowerQuery) ||
    tool.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}
`;
  }

  private generateZodSchema(schema: z.ZodType<any>): string {
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const props = Object.entries(shape).map(([key, value]) => {
        return `${key}: ${this.generateZodSchema(value as z.ZodType<any>)}`;
      });
      return `z.object({ ${props.join(', ')} })`;
    }

    if (schema instanceof z.ZodString) {
      let str = 'z.string()';
      if (schema.description) str += `.describe('${schema.description.replace(/'/g, "\\'")}')`;
      // Add other string validations if needed (min, max, email, etc.)
      // Note: Accessing internal checks is tricky in Zod, so we stick to basic types + description for now
      // or rely on the fact that we are generating code for *input validation* on the client side
      // which might be less strict than server side.
      // However, for a robust implementation, we should try to preserve as much as possible.
      // Given the complexity, we'll focus on the structure and description.
      return str;
    }

    if (schema instanceof z.ZodNumber) {
      let num = 'z.number()';
      if (schema.description) num += `.describe('${schema.description.replace(/'/g, "\\'")}')`;
      if (schema._def?.checks?.some((check: any) => check.kind === 'int')) num += '.int()';
      return num;
    }

    if (schema instanceof z.ZodBoolean) {
      let bool = 'z.boolean()';
      if (schema.description) bool += `.describe('${schema.description.replace(/'/g, "\\'")}')`;
      return bool;
    }

    if (schema instanceof z.ZodArray) {
      return `z.array(${this.generateZodSchema(schema.element)})`;
    }

    if (schema instanceof z.ZodEnum) {
      const values = schema._def.values;
      return `z.enum([${values.map((v: string) => `'${v}'`).join(', ')}])`;
    }

    if (schema instanceof z.ZodOptional) {
      return `${this.generateZodSchema(schema.unwrap())}.optional()`;
    }

    if (schema instanceof z.ZodDefault) {
      // Handle default values if possible, or just unwrap
      // For code generation, we might want to show the default
      const def = schema._def.defaultValue();
      const inner = this.generateZodSchema(schema.removeDefault());
      return `${inner}.default(${JSON.stringify(def)})`;
    }

    // Fallback for unknown types
    return 'z.any()';
  }

  private getCategoryComplexity(category: string): string {
    const tools = this.toolRegistry.getToolsByCategory(category);
    if (tools.some(t => t.complexity === 'complex')) return 'complex';
    if (tools.some(t => t.complexity === 'moderate')) return 'moderate';
    return 'simple';
  }

  async cleanup(): Promise<void> {
    // Clean up generated files
    try {
      await fs.rm(this.apiPath, { recursive: true, force: true });
      logger.info('Cleaned up generated API files');
    } catch (error) {
      logger.error('Failed to cleanup API files:', error);
    }
  }
}
