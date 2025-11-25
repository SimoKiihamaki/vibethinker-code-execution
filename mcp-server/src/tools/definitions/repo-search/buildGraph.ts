import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition } from '../../types.js';
import { resolveImportPath, validatePath } from '../../utils.js';

export const buildGraph: ToolDefinition = {
    name: 'buildGraph',
    description: 'Build comprehensive dependency graph of the repository',
    category: 'repo-search',
    inputSchema: z.object({
        rootPath: z.string().describe('Root path of the repository'),
        includeTypes: z.array(z.string()).optional().describe('File types to include'),
        excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude'),
    }),
    handler: async (args) => {
        const root = await validatePath(String(args.rootPath || process.cwd()));
        const types = Array.isArray(args.includeTypes) && args.includeTypes.length ? args.includeTypes : ['.ts', '.tsx', '.js', '.jsx'];
        const excludes = Array.isArray(args.excludePatterns) ? args.excludePatterns : ['node_modules', '.git', 'dist', 'build'];
        const excludeSet = new Set(excludes.map((pattern: string) => pattern.trim()).filter(Boolean));
        const files: string[] = [];
        async function walk(dir: string) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) {
                    if (excludeSet.has(e.name)) continue;
                    await walk(p);
                }
                else { if (types.some((t: string) => e.name.endsWith(t))) files.push(p); }
            }
        }
        await walk(root);
        const edges: Array<{ from: string; to: string }> = [];
        const inDeg: Record<string, number> = {};
        const outDeg: Record<string, number> = {};
        for (const f of files) {
            let c = '';
            try { c = await fs.readFile(f, 'utf8'); } catch { continue; }
            const dir = path.dirname(f);
            const re = /import\s+[^'";]*from\s+['"]([^'"\n]+)['"]|require\(\s*['"]([^'"\n]+)['"]\s*\)/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(c))) {
                const rel = m[1] || m[2];
                let to = rel;
                if (rel.startsWith('.')) {
                    const resolved = await resolveImportPath(f, rel);
                    if (!resolved) continue;
                    const relativeToRoot = path.relative(root, resolved);
                    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
                        continue;
                    }
                    to = resolved;
                }
                edges.push({ from: f, to });
                outDeg[f] = (outDeg[f] || 0) + 1;
                if (to.startsWith(root)) {
                    inDeg[to] = (inDeg[to] || 0) + 1;
                }
            }
        }
        const entryPoints = files.filter(f => !inDeg[f]);
        function findCycles() {
            const graph: Map<string, Set<string>> = new Map();
            for (const { from, to } of edges) {
                if (!graph.has(from)) graph.set(from, new Set());
                graph.get(from)!.add(to);
            }
            const cycles: string[][] = [];
            const seen = new Set<string>();
            const onStack = new Set<string>();
            const stack: string[] = [];
            const cycleSignatures = new Set<string>();

            const canonicalize = (cycle: string[]): string => {
                const nodes = cycle.slice(0, -1);
                if (nodes.length === 0) return '';
                let best = nodes;
                for (let i = 1; i < nodes.length; i++) {
                    const rotated = nodes.slice(i).concat(nodes.slice(0, i));
                    if (rotated.join('::') < best.join('::')) {
                        best = rotated;
                    }
                }
                return best.join('::');
            };

            const dfs = (node: string) => {
                seen.add(node);
                onStack.add(node);
                stack.push(node);

                const neighbors = graph.get(node);
                if (neighbors) {
                    for (const neighbor of neighbors) {
                        if (!seen.has(neighbor)) {
                            dfs(neighbor);
                        } else if (onStack.has(neighbor)) {
                            const idx = stack.indexOf(neighbor);
                            if (idx !== -1) {
                                const cyclePath = stack.slice(idx).concat(neighbor);
                                const signature = canonicalize(cyclePath);
                                if (signature && !cycleSignatures.has(signature)) {
                                    cycleSignatures.add(signature);
                                    cycles.push(cyclePath);
                                }
                            }
                        }
                    }
                }

                onStack.delete(node);
                stack.pop();
            };

            for (const file of files) {
                if (!seen.has(file)) {
                    dfs(file);
                }
            }
            return cycles;
        }
        const cycles = findCycles();
        const hotspots = Object.entries(outDeg).map(([file, outDegree]) => ({ file, inDegree: inDeg[file] || 0, outDegree })).sort((a, b) => (b.inDegree + b.outDegree) - (a.inDegree + a.outDegree)).slice(0, 20);
        const metrics = { files: files.length, imports: edges.length, cycles: cycles.length };
        const issues = cycles.map(c => ({ type: 'cycle', files: c, details: 'Detected circular dependency' }));
        const actions = issues.length ? ['Break cycles by extracting shared modules'] : ['No cycles detected'];
        return { summary: 'Dependency graph built', metrics, issues, entryPoints, hotspots, actions };
    },
    tags: ['graph', 'dependencies', 'visualization'],
    complexity: 'complex',
    externalDependencies: [],
    npmDependencies: [],
    internalDependencies: [],
};
