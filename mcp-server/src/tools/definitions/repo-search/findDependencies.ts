import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition } from '../../types.js';
import { validatePath, resolveImportPath } from '../../utils.js';

export const findDependencies: ToolDefinition = {
    name: 'findDependencies',
    description: 'Find all dependencies and imports for a given file or module',
    category: 'repo-search',
    inputSchema: z.object({
        filePath: z.string().describe('Path to the file to analyze'),
        depth: z.number().int().min(1).max(5).default(2).describe('Dependency depth to traverse'),
        includeExternal: z.boolean().default(false).describe('Include external npm packages'),
    }),
    handler: async (args) => {
        const startFile = await validatePath(String(args.filePath));
        const maxDepth = typeof args.depth === 'number' ? args.depth : 2;
        const includeExternal = typeof args.includeExternal === 'boolean' ? args.includeExternal : false;
        const visited = new Set<string>();
        const deps: Array<{ source: string; target: string; type: string }> = [];
        const errors: Array<{ file: string; message: string }> = [];
        async function resolve(file: string, depth: number) {
            if (visited.has(file)) return;
            visited.add(file);
            if (depth > maxDepth) return;
            let content = '';
            try {
                content = await fs.readFile(file, 'utf8');
            } catch (error) {
                errors.push({ file, message: (error as Error).message });
                return;
            }
            const dir = path.dirname(file);
            const re = /import\s+[^'";]*from\s+['"]([^'"\n]+)['"]|require\(\s*['"]([^'"\n]+)['"]\s*\)|import\(\s*['"]([^'"\n]+)['"]\s*\)/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(content))) {
                const targetRel = m[1] || m[2] || m[3];
                const type = m[1] ? 'import' : 'require';
                let targetPath = targetRel;
                if (targetRel.startsWith('.')) {
                    const resolved = await resolveImportPath(file, targetRel);
                    if (!resolved) {
                        errors.push({ file, message: `Failed to resolve ${targetRel}` });
                        continue;
                    }
                    targetPath = resolved;
                    deps.push({ source: file, target: targetPath, type });
                    if (depth >= maxDepth) {
                        continue;
                    }
                    await resolve(targetPath, depth + 1);
                } else {
                    // Only include external dependencies if flag is set
                    if (includeExternal) {
                        deps.push({ source: file, target: targetPath, type });
                    }
                }
            }
        }
        await resolve(startFile, 1);
        return {
            summary: `Resolved ${deps.length} dependencies`,
            dependencies: deps,
            errors: errors.length ? errors : undefined
        };
    },
    tags: ['dependencies', 'imports', 'graph'],
    complexity: 'complex',
    externalDependencies: [],
    npmDependencies: [],
    internalDependencies: [
        '../../utils.js:validatePath',
        '../../utils.js:resolveImportPath'
    ],
};
