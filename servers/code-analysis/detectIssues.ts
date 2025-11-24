import { z } from 'zod';
import { getMLXClient } from '../shared/utils.js';

/**
 * Detect potential issues, bugs, and code smells
 * 
 * Category: code-analysis
 * Complexity: complex
 * Tags: issues, bugs, code-smells
 */

const detectIssuesSchema = z.object({ target: z.string().describe('File or directory to analyze'), issueTypes: z.array(z.enum(['bugs', 'code-smells', 'security', 'performance'])).default(["bugs", "code-smells"]), confidence: z.enum(['low', 'medium', 'high']).default("medium") });

export interface detectIssuesInput extends z.infer<typeof detectIssuesSchema> { }

export interface detectIssuesResult {
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
 * Execute detectIssues tool with progressive disclosure
 */
export async function detectIssues(input: detectIssuesInput): Promise<detectIssuesResult> {
  // Validate input
  const validatedInput = detectIssuesSchema.parse(input);

  // Get MLX client instance
  const mlxClient = await getMLXClient();

  // Build context-aware prompt
  const prompt = builddetectIssuesPrompt(validatedInput);

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
      data: parsedetectIssuesResult(result, validatedInput),
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
 * Build context-aware prompt for detectIssues
 */
function builddetectIssuesPrompt(input: detectIssuesInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: detectIssues
Description: Detect potential issues, bugs, and code smells
Category: code-analysis
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
 * Parse and structure detectIssues results
 */
function parsedetectIssuesResult(result: string, input: detectIssuesInput): any {
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
