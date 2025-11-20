import { z } from 'zod';
import { getMLXClient, buildToolPrompt, parseToolResult, estimateTokens } from '../shared/utils.js';

/**
 * Analyze import patterns and circular dependencies
 * 
 * Category: repo-search
 * Complexity: complex
 * Tags: imports, cycles, patterns
 */

const analyzeImportsSchema = z.object({ directory: z.string().describe('Directory to analyze'), detectCycles: z.boolean().default(true), analyzePatterns: z.boolean().default(true) });

export interface analyzeImportsInput extends z.infer<typeof analyzeImportsSchema> {}

export interface analyzeImportsResult {
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
 * Execute analyzeImports tool with progressive disclosure
 */
export async function analyzeImports(input: analyzeImportsInput): Promise<analyzeImportsResult> {
  // Validate input
  const validatedInput = analyzeImportsSchema.parse(input);
  
  // Get MLX client instance
  const mlxClient = await getMLXClient();

  // Build context-aware prompt
  const prompt = buildToolPrompt(
    'analyzeImports',
    'Analyze import patterns and circular dependencies',
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

