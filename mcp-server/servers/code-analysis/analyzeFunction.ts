import { z } from 'zod';
import { MLXClient } from '../../mcp-server/src/client.js';

/**
 * Analyze specific function or method for complexity and best practices
 * 
 * Category: code-analysis
 * Complexity: moderate
 * Tags: function, analysis, complexity
 */

const analyzeFunctionSchema = z.object({});

export interface analyzeFunctionInput extends z.infer<typeof analyzeFunctionSchema> {}

export interface analyzeFunctionResult {
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
 * Execute analyzeFunction tool with progressive disclosure
 */
export async function analyzeFunction(input: analyzeFunctionInput): Promise<analyzeFunctionResult> {
  // Validate input
  const validatedInput = analyzeFunctionSchema.parse(input);
  
  // Get MLX client instance
  const mlxClient = new MLXClient();
  await mlxClient.initialize();
  
  // Build context-aware prompt
  const prompt = buildanalyzeFunctionPrompt(validatedInput);
  
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
      data: parseanalyzeFunctionResult(result, validatedInput),
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
 * Build context-aware prompt for analyzeFunction
 */
function buildanalyzeFunctionPrompt(input: analyzeFunctionInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Output only JSON per the schema below

Tool: analyzeFunction
Description: Analyze specific function or method for complexity and best practices
Category: code-analysis
Complexity: moderate

Input:
${JSON.stringify(input, null, 2)}

JSON schema:
{
  "summary": string,
  "function": string,
  "metrics": { "cyclomatic": number, "length": number, "params": number },
  "findings": [ { "type": string, "line": number, "details": string } ],
  "actions": [string]
}
`;
}

/**
 * Parse and structure analyzeFunction results
 */
function parseanalyzeFunctionResult(result: string, input: analyzeFunctionInput): any {
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
