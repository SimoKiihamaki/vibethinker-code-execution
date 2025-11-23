import { z } from 'zod';

export interface ToolDefinition {
    name: string;
    description: string;
    category: string;
    inputSchema: z.ZodObject<any>;
    handler: (args: any) => Promise<any>;
    tags: string[];
    complexity: 'simple' | 'moderate' | 'complex';
    dependencies: string[];
}
