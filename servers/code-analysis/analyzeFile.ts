import { z } from 'zod';
import { MLXClient } from '../../mcp-server/src/client.js';
import { buildToolPrompt, parseToolResult, estimateTokens } from '../utils.js';

/**
 * Deep analysis of a single file including complexity, patterns, and issues
 * 
 * Category: code-analysis
 * Complexity: moderate
 * Tags: analysis, file, complexity
 */

const analyzeFileSchema = z.object({
  filePath: z.string().describe('Path to the file to analyze'),
  analysisType: z.enum(['full', 'complexity', 'patterns', 'issues']).default('full'),
  includeSuggestions: z.boolean().default(true).describe('Include improvement suggestions'),
});

export interface analyzeFileInput extends z.infer<typeof analyzeFileSchema> { }

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
  const mlxClient = new MLXClient();
  await mlxClient.initialize();

  // Build context-aware prompt
  const prompt = buildToolPrompt(
    'analyzeFile',
    'Deep analysis of a single file including complexity, patterns, and issues',
    'code-analysis',
    'moderate',
    validatedInput
  );

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
      data: parseToolResult(result, validatedInput),
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
