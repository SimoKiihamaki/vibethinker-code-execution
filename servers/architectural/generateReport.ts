import { z } from 'zod';
import { estimateTokens, getMLXClient } from '../shared/utils.js';

/**
 * Generate a standalone HTML report visualizing architectural insights and dependency graphs
 * 
 * Category: architectural
 * Complexity: moderate
 * Tags: report, visualization, architecture
 */

const generateReportSchema = z.object({ directory: z.string().describe('Root directory of the project'), outputFile: z.string().default("architecture-report.html"), includeGraphs: z.boolean().default(true) });

export interface generateReportInput extends z.infer<typeof generateReportSchema> {}

export interface generateReportResult {
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
 * Execute generateReport tool with progressive disclosure
 */
export async function generateReport(input: generateReportInput): Promise<generateReportResult> {
  // Validate input
  const validatedInput = generateReportSchema.parse(input);
  
  // Get MLX client instance
  const mlxClient = await getMLXClient();
  
  // Build context-aware prompt
  const prompt = buildgenerateReportPrompt(validatedInput);
  
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
      data: parsegenerateReportResult(result, validatedInput),
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
 * Build context-aware prompt for generateReport
 */
function buildgenerateReportPrompt(input: generateReportInput): string {
  return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: generateReport
Description: Generate a standalone HTML report visualizing architectural insights and dependency graphs
Category: architectural
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
 * Parse and structure generateReport results
 */
function parsegenerateReportResult(result: string, input: generateReportInput): any {
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
