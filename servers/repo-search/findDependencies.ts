import { z } from 'zod';
import { getMLXClient, buildToolPrompt, parseToolResult, estimateTokens } from '../shared/utils.js';

/**
 * Find all dependencies and imports for a given file or module
 * 
 * Category: repo-search
 * Complexity: complex
 * Tags: dependencies, imports, graph
 */

const findDependenciesSchema = z.object({ filePath: z.string().describe('Path to the file to analyze'), depth: z.number().int().default(2), includeExternal: z.boolean().default(false) });

export interface findDependenciesInput extends z.infer<typeof findDependenciesSchema> {}

export interface findDependenciesResult {
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
 * Execute findDependencies tool with progressive disclosure
 */
export async function findDependencies(input: findDependenciesInput): Promise<findDependenciesResult> {
  // Validate input
  const validatedInput = findDependenciesSchema.parse(input);
  
  // Get MLX client instance
  const mlxClient = await getMLXClient();
  
  // Build context-aware prompt
  const prompt = buildToolPrompt(
    'findDependencies',
    'Find all dependencies and imports for a given file or module',
    'repo-search',
    'complex',
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

