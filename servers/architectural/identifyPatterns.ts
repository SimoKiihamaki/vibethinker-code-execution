import { z } from 'zod';
import { getMLXClient } from '../servers/shared/utils.js';

/**
 * Identify architectural patterns and design principles
 * 
 * Category: architectural
 * Complexity: complex
 * Tags: patterns, architecture, design
 */

const identifyPatternsSchema = z.object({ codebase: z.string().describe('Path to codebase to analyze'), patternTypes: z.array(z.enum(['design-patterns', 'architectural-patterns', 'microservices', 'ddd'])).default(["design-patterns"]), includeViolations: z.boolean().default(true) });

export interface identifyPatternsInput extends z.infer<typeof identifyPatternsSchema> {}

export interface identifyPatternsResult {
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
 * Execute identifyPatterns tool with progressive disclosure
 */
export async function identifyPatterns(input: identifyPatternsInput): Promise<identifyPatternsResult> {
  // Validate input
  const validatedInput = identifyPatternsSchema.parse(input);
  
  // Get MLX client instance
  const mlxClient = await getMLXClient();
  
  // Build context-aware prompt
  const prompt = buildidentifyPatternsPrompt(validatedInput);
  
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
      data: parseidentifyPatternsResult(result, validatedInput),
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
 * Build context-aware prompt for identifyPatterns
 */
function buildidentifyPatternsPrompt(input: identifyPatternsInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: identifyPatterns
Description: Identify architectural patterns and design principles
Category: architectural
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
 * Parse and structure identifyPatterns results
 */
function parseidentifyPatternsResult(result: string, input: identifyPatternsInput): any {
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
