import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import type { Dirent } from 'fs';
import { ToolDefinition } from '../../types.js';
import { validatePath, logger } from '../../utils.js';

type DepthSetting = 'shallow' | 'medium' | 'deep';
type ContextType = 'code' | 'dependencies' | 'documentation' | 'history';

const DEPTH_LIMITS: Record<DepthSetting, number> = {
    shallow: 1,
    medium: 3,
    deep: 5,
};

const IGNORED_SEGMENTS = new Set(['node_modules', '.git', 'dist', 'build']);

type DirectoryNode = {
    name: string;
    type: 'file' | 'directory';
    size?: number;
    children?: DirectoryNode[];
};

const extractImports = (content: string): string[] => {
    const imports: string[] = [];
    const re = /import\s+[^'";]*from\s+['"]([^'"\n]+)['"]|require\(\s*['"]([^'"\n]+)['"]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
        const spec = m[1] || m[2];
        if (spec) imports.push(spec);
    }
    return imports;
};

const shouldSkipDir = (name: string): boolean => IGNORED_SEGMENTS.has(name);

async function readPackageManifest(targetDir: string): Promise<{ name?: string; version?: string; dependencies: string[] } | null> {
    const pkgPath = path.join(targetDir, 'package.json');
    try {
        const raw = await fs.readFile(pkgPath, 'utf8');
        const parsed = JSON.parse(raw);
        const depSet = new Set<string>();
        for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const) {
            const section = parsed[field];
            if (section && typeof section === 'object') {
                Object.keys(section).forEach(dep => depSet.add(dep));
            }
        }
        return {
            name: typeof parsed.name === 'string' ? parsed.name : undefined,
            version: typeof parsed.version === 'string' ? parsed.version : undefined,
            dependencies: Array.from(depSet).sort(),
        };
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code !== 'ENOENT') {
            logger.warn(`Failed to parse package.json at ${pkgPath}: ${err?.message}`);
        }
        return null;
    }
}

async function summarizeReadmes(targetDir: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(targetDir);
        const readmes = entries.filter(entry => /^readme/i.test(entry));
        const summaries: string[] = [];
        for (const file of readmes.slice(0, 3)) {
            try {
                const content = await fs.readFile(path.join(targetDir, file), 'utf8');
                summaries.push(`${file}: ${content.split('\n').slice(0, 5).join(' ')}`);
            } catch (error) {
                logger.debug(`Failed to read documentation file ${file}: ${error}`);
            }
        }
        return summaries;
    } catch {
        return [];
    }
}

async function snapshotDirectory(targetDir: string, remainingDepth: number, visited: Set<string>): Promise<DirectoryNode[]> {
    const nodes: DirectoryNode[] = [];
    let entries: Dirent[];
    try {
        entries = await fs.readdir(targetDir, { withFileTypes: true });
    } catch (error) {
        logger.debug(`Failed to read directory ${targetDir}: ${error}`);
        return nodes;
    }

    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const resolved = await validatePath(path.join(targetDir, entry.name));
        if (entry.isDirectory()) {
            if (shouldSkipDir(entry.name)) continue;
            let realPath = resolved;
            try {
                realPath = await fs.realpath(resolved);
            } catch {
                // ignore
            }
            if (visited.has(realPath)) continue;
            visited.add(realPath);
            const node: DirectoryNode = { name: entry.name, type: 'directory' };
            if (remainingDepth > 0) {
                node.children = await snapshotDirectory(resolved, remainingDepth - 1, visited);
            }
            nodes.push(node);
        } else if (entry.isFile()) {
            try {
                const stats = await fs.stat(resolved);
                nodes.push({ name: entry.name, type: 'file', size: stats.size });
            } catch {
                nodes.push({ name: entry.name, type: 'file' });
            }
        }
        if (nodes.length >= 200) break;
    }

    return nodes;
}

export const gatherContext: ToolDefinition = {
    name: 'gatherContext',
    description: 'Gather comprehensive context about code, files, and relationships',
    category: 'context-building',
    inputSchema: z.object({
        target: z.string().describe('File, directory, or pattern to gather context for'),
        contextTypes: z.array(z.enum(['code', 'dependencies', 'documentation', 'history'])).default(['code', 'dependencies']),
        depth: z.enum(['shallow', 'medium', 'deep']).default('medium'),
    }),
    handler: async (args) => {
        const target = await validatePath(String(args.target));
        const requestedTypes = Array.isArray(args.contextTypes) && args.contextTypes.length
            ? (args.contextTypes as ContextType[])
            : ['code', 'dependencies'];
        const depthSetting = (args.depth ?? 'medium') as DepthSetting;
        const maxDepth = DEPTH_LIMITS[depthSetting];
        const context: Record<string, unknown> = {};
        const errors: Array<{ path: string; message: string }> = [];

        try {
            const stat = await fs.stat(target);
            context.targetType = stat.isFile() ? 'file' : 'directory';

            if (stat.isFile()) {
                const content = await fs.readFile(target, 'utf8');
                if (requestedTypes.includes('code')) {
                    context.code = content.length > 5000 ? `${content.slice(0, 5000)}\n…` : content;
                }
                if (requestedTypes.includes('dependencies')) {
                    context.dependencies = extractImports(content);
                }
                if (requestedTypes.includes('documentation')) {
                    const docBlocks = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
                    context.documentation = docBlocks.slice(0, 5);
                }
                if (requestedTypes.includes('history')) {
                    context.history = {
                        modifiedAt: stat.mtime.toISOString(),
                        size: stat.size,
                    };
                }
            } else if (stat.isDirectory()) {
                const visited = new Set<string>([await fs.realpath(target).catch(() => target)]);
                if (requestedTypes.includes('code')) {
                    context.structure = await snapshotDirectory(target, maxDepth, visited);
                }
                if (requestedTypes.includes('dependencies')) {
                    const manifest = await readPackageManifest(target);
                    if (manifest) {
                        context.packageInfo = manifest;
                    }
                }
                if (requestedTypes.includes('documentation')) {
                    context.documentation = await summarizeReadmes(target);
                }
                if (requestedTypes.includes('history')) {
                    context.history = {
                        modifiedAt: stat.mtime.toISOString(),
                        items: (context.structure as DirectoryNode[] | undefined)?.length ?? undefined,
                    };
                }
            }
        } catch (error) {
            errors.push({ path: target, message: (error as Error).message });
        }

        if (errors.length) {
            context.errors = errors;
        }

        return {
            context,
            target,
            contextTypes: requestedTypes,
            depth: depthSetting,
        };
    },
    tags: ['context', 'gathering', 'comprehensive'],
    complexity: 'moderate',
    externalDependencies: [],
    internalDependencies: [
        '../../utils.js:validatePath',
        '../../utils.js:logger'
    ],
};
