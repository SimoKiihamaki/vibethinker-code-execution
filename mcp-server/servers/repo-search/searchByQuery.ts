import { z } from 'zod';
import { MLXClient } from '../../mcp-server/src/client.js';

/**
 * Search repository by natural language query using ripgrep and semantic understanding
 * 
 * Category: repo-search
 * Complexity: moderate
 * Tags: search, ripgrep, semantic
 */

const searchByQuerySchema = z.object({});

export interface searchByQueryInput extends z.infer<typeof searchByQuerySchema> {}

export interface searchByQueryResult {
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
 * Execute searchByQuery tool with progressive disclosure
 */
export async function searchByQuery(input: searchByQueryInput): Promise<searchByQueryResult> {
  // Validate input
  const validatedInput = searchByQuerySchema.parse(input);
  
  // Get MLX client instance
  const mlxClient = new MLXClient();
  await mlxClient.initialize();
  
  // Build context-aware prompt
  const prompt = buildsearchByQueryPrompt(validatedInput);
  
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
      data: parsesearchByQueryResult(result, validatedInput),
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
 * Build context-aware prompt for searchByQuery
 */
function buildsearchByQueryPrompt(input: searchByQueryInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Tool: searchByQuery
Description: Search repository by natural language query using ripgrep and semantic understanding
Category: repo-search
Complexity: moderate

Input:
${JSON.stringify(input, null, 2)}

Generate a focused, efficient response that:
- Uses minimal tokens while providing maximum insight
- Follows progressive disclosure principles
- Includes actionable recommendations
- Identifies relevant patterns and dependencies
- Provides clear next steps

Return results in JSON format.`;
}

/**
 * Parse and structure searchByQuery results
 */
function parsesearchByQueryResult(result: string, input: searchByQueryInput): any {
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
