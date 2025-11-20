import { z } from 'zod';
import { getMLXClient, buildToolPrompt, parseToolResult, estimateTokens } from '../shared/utils.js';

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
  const mlxClient = await getMLXClient();

  // Build context-aware prompt
  const prompt = buildToolPrompt(
    'searchByQuery',
    'Search repository by natural language query using ripgrep and semantic understanding',
    'repo-search',
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

