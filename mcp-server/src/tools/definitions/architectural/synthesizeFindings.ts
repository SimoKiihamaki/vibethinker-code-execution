import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { synthesizeFindings as serverSynthesize } from '../../../../../servers/architectural/synthesizeFindings.js';

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
        const result = await serverSynthesize(args);
        if (!result.success) {
            throw new Error(result.error || 'Unknown error');
        }
        return result.data;
    },
    tags: ['synthesis', 'architecture', 'insights'],
    complexity: 'complex',
    // No external tool dependencies; this tool is self-contained.
    externalDependencies: [],
    npmDependencies: [],
    internalDependencies: [],
};
