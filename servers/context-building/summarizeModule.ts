import { z } from 'zod';
import { MLXClient } from '../../mcp-server/src/client.js';

/**
 * Create concise summary of module functionality and purpose
 * 
 * Category: context-building
 * Complexity: moderate
 * Tags: summary, module, documentation
 */

const summarizeModuleSchema = z.object({ modulePath: z.string().describe('Path to the module to summarize'), summaryType: z.enum(['brief', 'detailed', 'technical']).default("detailed"), includeDependencies: z.boolean().default(true) });

export interface summarizeModuleInput extends z.infer<typeof summarizeModuleSchema> {}

export interface summarizeModuleResult {
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
 * Execute summarizeModule tool with progressive disclosure
 */
export async function summarizeModule(input: summarizeModuleInput): Promise<summarizeModuleResult> {
  // Validate input
  const validatedInput = summarizeModuleSchema.parse(input);
  
  // Get MLX client instance
  const mlxClient = new MLXClient();
  await mlxClient.initialize();
  
  // Build context-aware prompt
  const prompt = buildsummarizeModulePrompt(validatedInput);
  
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
      data: parsesummarizeModuleResult(result, validatedInput),
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
 * Build context-aware prompt for summarizeModule
 */
function buildsummarizeModulePrompt(input: summarizeModuleInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: summarizeModule
Description: Create concise summary of module functionality and purpose
Category: context-building
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
 * Parse and structure summarizeModule results
 */
function parsesummarizeModuleResult(result: string, input: summarizeModuleInput): any {
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
