import { z } from 'zod';
import { getMLXClient, estimateTokens } from '../shared/utils.js';

let cachedClient: MLXClient | null = null;

async function getMLXClient(): Promise<MLXClient> {
  if (cachedClient) return cachedClient;
  const client = new MLXClient();
  await client.initialize();
  cachedClient = client;
  return client;
}

/**
 * Gather comprehensive context about code, files, and relationships
 * 
 * Category: context-building
 * Complexity: moderate
 * Tags: context, gathering, comprehensive
 */

const gatherContextSchema = z.object({ target: z.string().describe('File, directory, or pattern to gather context for'), contextTypes: z.array(z.enum(['code', 'dependencies', 'documentation', 'history'])).default(["code","dependencies"]), depth: z.enum(['shallow', 'medium', 'deep']).default("medium") });

export interface gatherContextInput extends z.infer<typeof gatherContextSchema> {}

export interface gatherContextResult {
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
 * Execute gatherContext tool with progressive disclosure
 */
export async function gatherContext(input: gatherContextInput): Promise<gatherContextResult> {
  // Validate input
  const validatedInput = gatherContextSchema.parse(input);
  
  // Get MLX client instance
  const mlxClient = await getMLXClient();
  
  // Build context-aware prompt
  const prompt = buildGatherContextPrompt(validatedInput);
  
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
      data: parseGatherContextResult(result, validatedInput),
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
 * Build context-aware prompt for gatherContext
 */
function buildGatherContextPrompt(input: gatherContextInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: gatherContext
Description: Gather comprehensive context about code, files, and relationships
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
 * Parse and structure gatherContext results
 */
function parseGatherContextResult(result: string, input: gatherContextInput): any {
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
