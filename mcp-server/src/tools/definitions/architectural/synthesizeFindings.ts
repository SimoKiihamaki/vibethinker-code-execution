import { z } from 'zod';
import { ToolDefinition } from '../../types.js';

export const synthesizeFindings: ToolDefinition = {
    name: 'synthesizeFindings',
    description: 'Synthesize multiple analysis findings into coherent architectural insights',
    category: 'architectural',
    inputSchema: z.object({
        findings: z.array(z.object({}).passthrough()).describe('Array of analysis findings to synthesize'),
        topic: z.string().describe('Topic or area of focus'),
        depth: z.enum(['overview', 'detailed', 'comprehensive']).default('detailed'),
        includeRecommendations: z.boolean().default(true).describe('Include architectural recommendations'),
    }),
    handler: async (args) => {
        const findings = args.findings as any[];
        const topic = args.topic;
        const includeRecommendations = args.includeRecommendations ?? true;

        // Group findings by type
        const byType: Record<string, any[]> = {};
        for (const f of findings) {
            const type = f.type || 'unknown';
            if (!byType[type]) byType[type] = [];
            byType[type].push(f);
        }

        // Generate synthesis summary
        let synthesis = `Synthesis of ${findings.length} findings for topic "${topic}":\n`;
        for (const [type, items] of Object.entries(byType)) {
            synthesis += `- ${type}: ${items.length} items\n`;
            if (args.depth !== 'overview') {
                const highSeverity = items.filter(i => i.severity === 'high' || i.severity === 'critical');
                if (highSeverity.length > 0) {
                    synthesis += `  ⚠️ ${highSeverity.length} high severity issues identified.\n`;
                }
                if (args.depth === 'comprehensive') {
                    items.slice(0, 5).forEach(item => {
                        const description = item.detail || item.message || 'See source finding for details.';
                        synthesis += `    • ${description}\n`;
                    });
                }
            }
        }

        const recommendations: string[] = [];
        if (includeRecommendations) {
            for (const [type, items] of Object.entries(byType)) {
                const criticalCount = items.filter(i => i.severity === 'critical').length;
                if (criticalCount > 0) {
                    recommendations.push(`Prioritize remediation of ${criticalCount} critical ${type} issues.`);
                } else if (items.length > 0) {
                    recommendations.push(`Schedule follow-up review for ${type} findings (${items.length} items).`);
                }
            }
            if (recommendations.length === 0) {
                recommendations.push('No actionable recommendations generated from the supplied findings.');
            }
        }

        return {
            synthesis: {
                summary: synthesis,
                breakdown: byType,
                timestamp: Date.now(),
                recommendations: includeRecommendations ? recommendations : undefined,
            },
            findings: args.findings,
            topic: args.topic,
            depth: args.depth,
        };
    },
    tags: ['synthesis', 'architecture', 'insights'],
    complexity: 'complex',
    // No external tool dependencies; this tool is self-contained.
};
