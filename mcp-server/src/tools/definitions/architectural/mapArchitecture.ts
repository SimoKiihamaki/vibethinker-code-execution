import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition } from '../../types.js';
import { validatePath, logger, resolveImportPath } from '../../utils.js';

export const mapArchitecture: ToolDefinition = {
    name: 'mapArchitecture',
    description: 'Create comprehensive architectural map of the codebase',
    category: 'architectural',
    inputSchema: z.object({
        rootPath: z.string().describe('Root path of the repository'),
        layers: z.array(z.string()).optional().describe('Architectural layers to identify'),
        includeDependencies: z.boolean().default(true).describe('Include dependency mapping'),
    }),
    handler: async (args) => {
        const root = await validatePath(String(args.rootPath || process.cwd()));
        const layers: string[] = Array.isArray(args.layers) ? args.layers : [];
        const includeDeps = !!args.includeDependencies;
        const files: string[] = [];
        async function walk(dir: string) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) { if (/^(node_modules|\.git|dist|build)$/.test(e.name)) continue; await walk(p); }
                else if (/[.](ts|tsx|js|jsx)$/.test(e.name)) files.push(p);
            }
        }
        await walk(root);
        const layerMap: Record<string, string[]> = {};
        function assign(file: string): string {
            const f = file.toLowerCase();
            if (/(components|pages|ui|renderer)/.test(f)) return 'ui';
            if (/(services|store|logic)/.test(f)) return 'business-logic';
            if (/(models|db|data)/.test(f)) return 'data';
            if (/(electron|main|config|infrastructure)/.test(f)) return 'infrastructure';
            return 'unknown';
        }
        for (const f of files) {
            const l = assign(f);
            layerMap[l] = layerMap[l] || [];
            layerMap[l].push(f);
        }
        let dependencies: Array<{ from: string; to: string }> = [];
        if (includeDeps) {
            for (const f of files) {
                let c = '';
                try { c = await fs.readFile(f, 'utf8'); } catch (error) { logger.debug(`Failed to read ${f}: ${error}`); continue; }
                const dir = path.dirname(f);
                const re = /import\s+[^'";]*from\s+['"]([^'"\n]+)['"]|require\(\s*['"]([^'"\n]+)['"]\s*\)/g;
                let m: RegExpExecArray | null;
                while ((m = re.exec(c))) {
                    const rel = m[1] || m[2];
                    let to = rel;
                    if (rel.startsWith('.')) {
                        const resolved = await resolveImportPath(f, rel);
                        if (!resolved) continue;
                        const relative = path.relative(root, resolved);
                        if (relative.startsWith('..') || path.isAbsolute(relative)) {
                            continue;
                        }
                        to = resolved;
                    }
                    dependencies.push({ from: f, to });
                }
            }
        }
        const layersOut = layers.length ? layers.map(l => ({ name: l, files: layerMap[l] || [] })) : Object.keys(layerMap).map(l => ({ name: l, files: layerMap[l] }));
        return { summary: 'Architectural map generated', layers: layersOut, dependencies };
    },
    tags: ['architecture', 'mapping', 'layers'],
    complexity: 'complex',
    dependencies: [],
};
