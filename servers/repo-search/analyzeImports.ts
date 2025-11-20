import { z } from 'zod';
import { MLXClient } from '../../mcp-server/src/client.js';

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
  const mlxClient = new MLXClient();
  await mlxClient.initialize();
  
  // Build context-aware prompt
  const prompt = buildanalyzeImportsPrompt(validatedInput);
  
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
      data: parseanalyzeImportsResult(result, validatedInput),
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
 * Build context-aware prompt for analyzeImports
 */
function buildanalyzeImportsPrompt(input: analyzeImportsInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: analyzeImports
Description: Analyze import patterns and circular dependencies
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
 * Parse and structure analyzeImports results
 */
function parseanalyzeImportsResult(result: string, input: analyzeImportsInput): any {
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
