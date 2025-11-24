import { z } from 'zod';
import { getMLXClient } from '../shared/utils.js';

/**
 * Find all dependencies and imports for a given file or module
 * 
 * Category: repo-search
 * Complexity: complex
 * Tags: dependencies, imports, graph
 */

const findDependenciesSchema = z.object({ filePath: z.string().describe('Path to the file to analyze'), depth: z.number().int().default(2), includeExternal: z.boolean().default(false) });

export interface findDependenciesInput extends z.infer<typeof findDependenciesSchema> { }

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
  const prompt = buildfindDependenciesPrompt(validatedInput);

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
      data: parsefindDependenciesResult(result, validatedInput),
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
 * Build context-aware prompt for findDependencies
 */
function buildfindDependenciesPrompt(input: findDependenciesInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: findDependencies
Description: Find all dependencies and imports for a given file or module
Category: repo-search
Complexity: complex

Input:
${JSON.stringify(input, null, 2)}

Output requirements:
- Provide precise, actionable insights
- Include specific recommendations and clear next steps
- Identify relevant patterns and dependencies
- Minimize tokens while maximizing clarity`;
}

/**
 * Parse and structure findDependencies results
 */
function parsefindDependenciesResult(result: string, input: findDependenciesInput): any {
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
