import { z } from 'zod';
import { getMLXClient, estimateTokens } from '../shared/utils.js';

let cachedClient: MLXClient | null = null;

export async function getMLXClient(): Promise<MLXClient> {
  if (cachedClient) return cachedClient;
  const client = new MLXClient();
  await client.initialize();
  cachedClient = client;
  return client;
}

export function buildToolPrompt(
    toolName: string,
    description: string,
    category: string,
    complexity: string,
    input: any
): string {
    return `You are VibeThinker, an expert code analysis AI.

Identity: VibeThinker
Mode: concise, plain text

Constraints:
- Respond in English
- Do not use markdown or code fences
- Do not include meta-instructions or internal reasoning
- Keep natural-language responses under 180 words

Tool: ${toolName}
Description: ${description}
Category: ${category}
Complexity: ${complexity}

Input:
${JSON.stringify(input, null, 2)}

Output requirements:
- Provide precise, actionable insights
- Include specific recommendations and clear next steps
- Identify relevant patterns and dependencies
- Minimize tokens while maximizing clarity`;
}

export function parseToolResult(result: string, input: any): any {
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

export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}
