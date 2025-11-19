import { z } from 'zod';
import { MLXClient } from '../../mcp-server/src/client.js';
import { buildToolPrompt, parseToolResult, estimateTokens } from '../utils.js';

/**
 * Gather comprehensive context about code, files, and relationships
 * 
 * Category: context-building
 * Complexity: moderate
 * Tags: context, gathering, comprehensive
 */

const gatherContextSchema = z.object({
  query: z.string().describe('The user query or intent to gather context for'),
  files: z.array(z.string()).optional().describe('Specific files to include in the context'),
  maxDepth: z.number().optional().default(2).describe('Maximum depth for recursive dependency search'),
  includeImports: z.boolean().optional().default(true).describe('Whether to follow and include imports'),
  includeTypes: z.boolean().optional().default(true).describe('Whether to include type definitions'),
  focus: z.enum(['broad', 'precise', 'dependencies', 'implementation']).optional().default('precise').describe('Strategy for context gathering')
});

export interface gatherContextInput extends z.infer<typeof gatherContextSchema> { }

export interface gatherContextResult {
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
 * Execute gatherContext tool with progressive disclosure
 */
export async function gatherContext(input: gatherContextInput): Promise<gatherContextResult> {
  // Validate input
  const validatedInput = gatherContextSchema.parse(input);

  // Get MLX client instance
  const mlxClient = new MLXClient();
  await mlxClient.initialize();

  // Build context-aware prompt
  const prompt = buildToolPrompt(
    'gatherContext',
    'Gather comprehensive context about code, files, and relationships',
    'context-building',
    'moderate',
    validatedInput
  );

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
      data: parseToolResult(result, validatedInput),
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
