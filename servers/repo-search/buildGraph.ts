import { z } from 'zod';
import { getMLXClient, buildToolPrompt, parseToolResult, estimateTokens } from '../shared/utils.js';

/**
 * Build comprehensive dependency graph of the repository
 * 
 * Category: repo-search
 * Complexity: complex
 * Tags: graph, dependencies, visualization
 */

const buildGraphSchema = z.object({ rootPath: z.string().describe('Root path of the repository'), includeTypes: z.array(z.string()).optional(), excludePatterns: z.array(z.string()).optional() });

export interface buildGraphInput extends z.infer<typeof buildGraphSchema> {}

export interface buildGraphResult {
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
 * Execute buildGraph tool with progressive disclosure
 */
export async function buildGraph(input: buildGraphInput): Promise<buildGraphResult> {
  // Validate input
  const validatedInput = buildGraphSchema.parse(input);
  
  // Get MLX client instance
  const mlxClient = await getMLXClient();
  
  // Build context-aware prompt
  const prompt = buildToolPrompt(
    'buildGraph',
    'Build comprehensive dependency graph of the repository',
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

