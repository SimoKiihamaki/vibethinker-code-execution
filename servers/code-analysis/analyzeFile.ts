import { z } from 'zod';
import { estimateTokens, getMLXClient } from '../shared/utils.js';

/**
 * Deep analysis of a single file including complexity, patterns, and issues
 * 
 * Category: code-analysis
 * Complexity: moderate
 * Tags: analysis, file, complexity
 */

const analyzeFileSchema = z.object({ filePath: z.string().describe('Path to the file to analyze'), analysisType: z.enum(['full', 'complexity', 'patterns', 'issues']).default("full"), includeSuggestions: z.boolean().default(true) });

export interface analyzeFileInput extends z.infer<typeof analyzeFileSchema> {}

export interface analyzeFileResult {
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
 * Execute analyzeFile tool with progressive disclosure
 */
export async function analyzeFile(input: analyzeFileInput): Promise<analyzeFileResult> {
  // Validate input
  const validatedInput = analyzeFileSchema.parse(input);
  
  // Get MLX client instance
  const mlxClient = await getMLXClient();
  
  // Build context-aware prompt
  const prompt = buildanalyzeFilePrompt(validatedInput);
  
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
      data: parseanalyzeFileResult(result, validatedInput),
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
 * Build context-aware prompt for analyzeFile
 */
function buildanalyzeFilePrompt(input: analyzeFileInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: analyzeFile
Description: Deep analysis of a single file including complexity, patterns, and issues
Category: code-analysis
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
 * Parse and structure analyzeFile results
 */
function parseanalyzeFileResult(result: string, input: analyzeFileInput): any {
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
