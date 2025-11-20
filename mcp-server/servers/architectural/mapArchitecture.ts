import { z } from 'zod';
import { getMLXClient, estimateTokens } from '../shared/utils.js';

/**
 * Create comprehensive architectural map of the codebase
 * 
 * Category: architectural
 * Complexity: complex
 * Tags: architecture, mapping, layers
 */

const mapArchitectureSchema = z.object({ rootPath: z.string().describe('Root path of the repository'), layers: z.array(z.string()).optional(), includeDependencies: z.boolean().default(true) });

export interface mapArchitectureInput extends z.infer<typeof mapArchitectureSchema> {}

export interface mapArchitectureResult {
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
 * Execute mapArchitecture tool with progressive disclosure
 */
export async function mapArchitecture(input: mapArchitectureInput): Promise<mapArchitectureResult> {
  const startTime = Date.now();
  try {
    // Validate input
    const validatedInput = mapArchitectureSchema.parse(input);

    // Get MLX client instance
    const mlxClient = await getMLXClient();

    // Build context-aware prompt
    const prompt = buildmapArchitecturePrompt(validatedInput);

    // Execute through MLX backend
    const result = await mlxClient.generateCompletion(prompt, {
      temperature: 0.1,
      max_tokens: 4096,
    });
    
    const executionTime = Date.now() - startTime;
    
    return {
      success: true,
      data: parsemapArchitectureResult(result, validatedInput),
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
 * Build context-aware prompt for mapArchitecture
 */
function buildmapArchitecturePrompt(input: mapArchitectureInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: mapArchitecture
Description: Create comprehensive architectural map of the codebase
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
 * Parse and structure mapArchitecture results
 */
function parsemapArchitectureResult(result: string, input: mapArchitectureInput): any {
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

