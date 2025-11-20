import { z } from 'zod';
import { getMLXClient, estimateTokens } from '../shared/utils.js';

/**
 * Search repository by natural language query using ripgrep and semantic understanding
 * 
 * Category: repo-search
 * Complexity: moderate
 * Tags: search, ripgrep, semantic
 */

const searchByQuerySchema = z.object({ query: z.string().describe('Natural language search query'), fileTypes: z.array(z.string()).optional(), maxResults: z.number().int().default(20), contextLines: z.number().int().default(3) });

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

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: searchByQuery
Description: Search repository by natural language query using ripgrep and semantic understanding
Category: repo-search
Complexity: moderate

Input:
${JSON.stringify(input, null, 2)}

Output requirements:
- Provide precise, actionable insights
- Include specific recommendations and clear next steps
- Identify relevant patterns and dependencies
- Minimize tokens while maximizing clarity`;
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
