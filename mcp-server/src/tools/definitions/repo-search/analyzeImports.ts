import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition } from '../../types.js';
import { validatePath, logger, resolveImportPath } from '../../utils.js';

export const analyzeImports: ToolDefinition = {
    name: 'analyzeImports',
    description: 'Analyze import patterns and circular dependencies',
    category: 'repo-search',
    inputSchema: z.object({
        directory: z.string().describe('Directory to analyze'),
        detectCycles: z.boolean().default(true).describe('Detect circular dependencies'),
        analyzePatterns: z.boolean().default(true).describe('Analyze import patterns'),
    }),
    handler: async (args) => {
        const dirRoot = await validatePath(String(args.directory));
        const detectCycles = typeof args.detectCycles === 'boolean' ? args.detectCycles : true;
        const analyzePatterns = typeof args.analyzePatterns === 'boolean' ? args.analyzePatterns : true;
        const files: string[] = [];
        const dependencyGraph = new Map<string, Set<string>>();
        const importCounts: Record<string, number> = {};

        async function walk(dir: string) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const e of entries) {
                    const p = path.join(dir, e.name);
                    if (e.isDirectory()) {
                        if (/^(node_modules|\.git|dist|build)$/.test(e.name)) continue;
                        await walk(p);
                    }
                    else if (/[.](ts|tsx|js|jsx)$/.test(e.name)) files.push(p);
                }
            } catch (err) {
                // Skip unreadable directories
            }
        }
        await walk(dirRoot);
        const filesSet = new Set(files);

        // Build import graph
        for (const f of files) {
            let c = '';
            try { c = await fs.readFile(f, 'utf8'); } catch (err) {
                logger.debug(`Failed to read file ${f}: ${err}`);
                continue;
            }
            const re = /import\s+[^'";]*from\s+['"]([^'"\n]+)['"]|require\(\s*['"]([^'"\n]+)['"]\s*\)/g;
            const deps: Set<string> = new Set();
            let m: RegExpExecArray | null;
            while ((m = re.exec(c))) {
                const spec = m[1] || m[2];
                importCounts[spec] = (importCounts[spec] || 0) + 1;
                if (spec.startsWith('.')) {
                    const resolved = await resolveImportPath(f, spec);
                    if (!resolved) continue;
                    const relative = path.relative(dirRoot, resolved);
                    if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
                    deps.add(resolved);
                }
            }
            dependencyGraph.set(f, deps);
        }

        // Detect cycles if requested
        const cycles: Array<Array<string>> = [];
        if (detectCycles) {
            const visited = new Set<string>();
            const recursionStack = new Set<string>();

            function dfs(node: string, currentPath: string[]): boolean {
                if (recursionStack.has(node)) {
                    // Found a cycle
                    const cycleStart = currentPath.indexOf(node);
                    if (cycleStart !== -1) {
                        cycles.push(currentPath.slice(cycleStart));
                    }
                    return true;
                }
                if (visited.has(node)) return false;

                visited.add(node);
                recursionStack.add(node);
                currentPath.push(node);

                const deps = dependencyGraph.get(node);
                if (deps) {
                    for (const targetFile of deps) {
                        if (filesSet.has(targetFile)) {
                            dfs(targetFile, currentPath);
                        }
                    }
                }

                recursionStack.delete(node);
                currentPath.pop();
                return false;
            }

            for (const file of files) {
                if (!visited.has(file)) {
                    dfs(file, []);
                }
            }
        }

        // Analyze patterns if requested
        const patterns: Array<{ name: string; count: number }> = [];
        if (analyzePatterns) {
            patterns.push(...Object.entries(importCounts).map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count).slice(0, 20));
        }

        return {
            summary: `Analyzed ${files.length} files`,
            metrics: { filesAnalyzed: files.length, imports: Object.values(importCounts).reduce((sum, count) => sum + count, 0), cycles: cycles.length },
            cycles,
            patterns
        };
    },
    tags: ['imports', 'cycles', 'patterns'],
    complexity: 'complex',
    externalDependencies: [],
    internalDependencies: [
        '../../utils.js:validatePath',
        '../../utils.js:resolveImportPath'
    ],
};
