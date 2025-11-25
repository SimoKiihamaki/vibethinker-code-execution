import { z } from 'zod';
import { ToolDefinition } from '../../types.js';

const synthesizeFindingsSchema = z.object({
  findings: z.array(z.object({
    type: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    detail: z.string().optional(),
    message: z.string().optional()
  })),
  topic: z.string().describe('Topic or area of focus'),
  depth: z.enum(['overview', 'detailed', 'comprehensive']).default("detailed"),
  includeRecommendations: z.boolean().default(true)
});

/**
 * Build context-aware prompt for synthesizeFindings
 */
function buildSynthesizeFindingsPrompt(input: any): string {
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
 * Execute synthesizeFindings tool
 */
async function executeSynthesizeFindings(input: any): Promise<any> {
  // For now, return a simple synthesis implementation
  const prompt = buildSynthesizeFindingsPrompt(input);

  // Simple synthesis logic
  const findings = input.findings || [];
  const topic = input.topic || 'Analysis';

  const synthesis = {
    topic,
    totalFindings: findings.length,
    severityDistribution: findings.reduce((acc: any, finding: any) => {
      const severity = finding.severity || 'low';
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {}),
    keyInsights: findings.slice(0, 5).map((f: any) => f.message || f.detail).filter(Boolean),
    recommendations: input.includeRecommendations ? [
      'Address high severity findings first',
      'Consider architectural patterns for structural improvements',
      'Implement automated testing to prevent regressions'
    ] : [],
    timestamp: Date.now()
  };

  return synthesis;
}

export const synthesizeFindings: ToolDefinition = {
    name: 'synthesizeFindings',
    description: 'Synthesize multiple analysis findings into coherent architectural insights',
    category: 'architectural',
    inputSchema: z.object({
        findings: z.array(z.object({
            type: z.string().optional(),
            severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
            detail: z.string().optional(),
            message: z.string().optional(),
        }).passthrough()).describe('Array of analysis findings to synthesize'),
        topic: z.string().describe('Topic or area of focus'),
        depth: z.enum(['overview', 'detailed', 'comprehensive']).default('detailed'),
        includeRecommendations: z.boolean().default(true).describe('Include architectural recommendations'),
    }),
    handler: async (args) => {
        return await executeSynthesizeFindings(args);
    },
    tags: ['synthesis', 'architecture', 'insights'],
    complexity: 'complex',
    // No external tool dependencies; this tool is self-contained.
    externalDependencies: [],
    npmDependencies: [],
    internalDependencies: [],
};
