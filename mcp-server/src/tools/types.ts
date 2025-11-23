import { z } from 'zod';

export interface ToolDefinition {
    name: string;
    description: string;
    category: string;
    inputSchema: z.ZodObject<any>;
    handler: (args: any) => Promise<any>;
    tags: string[];
    complexity: 'simple' | 'moderate' | 'complex';
    // The `externalDependencies` field lists conceptual or architectural dependencies required by this tool.
    // These are not npm packages, but represent required capabilities or modules in the system.
    externalDependencies: string[]; // e.g., ['ripgrep']
    // The `npmDependencies` field lists npm package dependencies required by this tool.
    npmDependencies: string[]; // e.g., ['@ast-grep/napi']
    internalDependencies: string[]; // e.g., ['../../utils.js:validatePath']
}
