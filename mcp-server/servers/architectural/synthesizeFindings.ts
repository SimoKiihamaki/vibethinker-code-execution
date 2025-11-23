import { z } from 'zod';
import { estimateTokens, getMLXClient } from '../shared/utils.js';

/**
 * Synthesize multiple analysis findings into coherent architectural insights
 * 
 * Category: architectural
 * Complexity: complex
 * Tags: synthesis, architecture, insights
 */

// Define base finding schema with required fields
const baseFindingSchema = z.object({
  type: z.string().describe('Type of finding'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Severity level'),
  message: z.string().describe('Description of the finding'),
});

// Define specific finding types with discriminated unions
const codeSmellFindingSchema = baseFindingSchema.extend({
  type: z.literal('code-smells'),
  detail: z.string().optional().describe('Additional details about the code smell'),
});

const bugFindingSchema = baseFindingSchema.extend({
  type: z.literal('bugs'),
  file: z.string().optional().describe('File where the bug was found'),
  line: z.number().optional().describe('Line number of the bug'),
});

const securityFindingSchema = baseFindingSchema.extend({
  type: z.literal('security'),
  file: z.string().optional().describe('File where the security issue was found'),
  line: z.number().optional().describe('Line number of the security issue'),
});

const performanceFindingSchema = baseFindingSchema.extend({
  type: z.literal('performance'),
  file: z.string().optional().describe('File where the performance issue was found'),
  line: z.number().optional().describe('Line number of the performance issue'),
});

const antiPatternFindingSchema = baseFindingSchema.extend({
  type: z.literal('anti-pattern'),
  file: z.string().optional().describe('File where the anti-pattern was found'),
  line: z.number().optional().describe('Line number of the anti-pattern'),
});

// Union of all finding types
const findingSchema = z.discriminatedUnion('type', [
  codeSmellFindingSchema,
  bugFindingSchema,
  securityFindingSchema,
  performanceFindingSchema,
  antiPatternFindingSchema,
  // Allow legacy/extended finding types for backward compatibility
  baseFindingSchema,
]);

const synthesizeFindingsSchema = z.object({
  findings: z.array(findingSchema),
  topic: z.string().describe('Topic or area of focus'),
  depth: z.enum(['overview', 'detailed', 'comprehensive']).default("detailed"),
  includeRecommendations: z.boolean().default(true)
});

export interface synthesizeFindingsInput extends z.infer<typeof synthesizeFindingsSchema> {}

export interface synthesizeFindingsResult {
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
 * Execute synthesizeFindings tool with progressive disclosure
 */
export async function synthesizeFindings(input: synthesizeFindingsInput): Promise<synthesizeFindingsResult> {
  // Validate input
  const validatedInput = synthesizeFindingsSchema.parse(input);
  
  // Get shared MLX client instance
  const mlxClient = await getMLXClient();
  
  // Build context-aware prompt
  const prompt = buildsynthesizeFindingsPrompt(validatedInput);
  
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
      data: parsesynthesizeFindingsResult(result, validatedInput),
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
 * Build context-aware prompt for synthesizeFindings
 */
function buildsynthesizeFindingsPrompt(input: synthesizeFindingsInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: synthesizeFindings
Description: Synthesize multiple analysis findings into coherent architectural insights
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
 * Parse and structure synthesizeFindings results
 */
function parsesynthesizeFindingsResult(result: string, input: synthesizeFindingsInput): any {
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

