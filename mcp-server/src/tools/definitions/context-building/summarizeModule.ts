import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition } from '../../types.js';
import { SOURCE_EXTENSIONS, getRepositoryRealPath, isPathWithinRepo, resolveImportPath, validatePath } from '../../utils.js';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

const collectDependencies = async (moduleRoot: string): Promise<string[]> => {
    const deps = new Set<string>();
    const visitedDirs = new Set<string>();
    const repoRealPath = await getRepositoryRealPath();

    let moduleRealPath: string;
    try {
        moduleRealPath = await fs.realpath(moduleRoot);
        const stats = await fs.stat(moduleRealPath);
        if (!stats.isDirectory()) {
            throw new Error(`${moduleRoot} is not a directory`);
        }
    } catch (error) {
        throw new Error(`Unable to inspect module root ${moduleRoot}: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!isPathWithinRepo(moduleRealPath, repoRealPath)) {
        throw new Error(`Module root ${moduleRoot} is outside the repository boundaries`);
    }

    const walk = async (target: string) => {
        let entries: fs.Dirent[];
        try {
            entries = await fs.readdir(target, { withFileTypes: true });
        } catch {
            return;
        }

        let realPath = target;
        try {
            realPath = await fs.realpath(target);
        } catch {
            // ignore realpath failures and fall back to the original path
        }
        if (visitedDirs.has(realPath)) return;
        visitedDirs.add(realPath);

        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const fullPath = path.join(target, entry.name);
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue;
                await walk(fullPath);
            } else if (entry.isFile() && SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
                let content = '';
                try {
                    content = await fs.readFile(fullPath, 'utf8');
                } catch {
                    continue;
                }
                const importRegex = /import\s+[^'";]*from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g;
                let match: RegExpExecArray | null;
                while ((match = importRegex.exec(content))) {
                    const spec = match[1] || match[2] || match[3];
                    if (!spec) continue;
                    if (spec.startsWith('.')) {
                        const resolved = await resolveImportPath(fullPath, spec);
                        if (!resolved) continue;
                        const relative = path.relative(moduleRealPath, resolved);
                        // Use '.' to represent a self-import (module referencing its root)
                        const label = relative === '' ? '.' : relative;
                        deps.add(label);
                    } else {
                        deps.add(spec);
                    }
                }
            }
        }
    };

    await walk(moduleRealPath);
    return Array.from(deps).sort();
};

export const summarizeModule: ToolDefinition = {
    name: 'summarizeModule',
    description: 'Create concise summary of module functionality and purpose',
    category: 'context-building',
    inputSchema: z.object({
        modulePath: z.string().describe('Path to the module to summarize'),
        summaryType: z.enum(['brief', 'detailed', 'technical']).default('detailed'),
        includeDependencies: z.boolean().default(true).describe('Include dependency summary'),
    }),
    handler: async (args) => {
        const modulePath = await validatePath(String(args.modulePath));
        let summary = '';
        let dependencies: string[] = [];

        const extractExports = (source: string): string[] => {
            const names = new Set<string>();
            let match: RegExpExecArray | null;

            const declarationExports = /export\s+(?:class|interface|function|const|let|var|type)\s+([\w$]+)/g;
            while ((match = declarationExports.exec(source))) {
                names.add(match[1]);
            }

            const defaultExports = /export\s+default\s+([\w$]+)/g;
            while ((match = defaultExports.exec(source))) {
                names.add(`${match[1]} (default)`);
            }

            const braceExports = /export\s*{\s*([^}]+)\s*}(?:\s+from\s+['"][^'"]+['"])?/g;
            while ((match = braceExports.exec(source))) {
                const parts = match[1].split(',');
                for (const part of parts) {
                    const cleaned = part.trim();
                    if (!cleaned) continue;
                    const aliasParts = cleaned.split(/\s+as\s+/i);
                    const exportName = aliasParts[aliasParts.length - 1].trim();
                    names.add(exportName);
                }
            }

            const namespaceExports = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
            while ((match = namespaceExports.exec(source))) {
                names.add(`* from ${match[1]}`);
            }

            return Array.from(names);
        };

        try {
            const stat = await fs.stat(modulePath);
            if (stat.isDirectory()) {
                // Try to find entry point
                const entries = ['index.ts', 'index.js', 'main.ts', 'main.js'];
                let entryFile = '';
                for (const e of entries) {
                    if (await fs.access(path.join(modulePath, e)).then(() => true).catch(() => false)) {
                        entryFile = path.join(modulePath, e);
                        break;
                    }
                }

                if (entryFile) {
                    const content = await fs.readFile(entryFile, 'utf8');
                    const exportNames = extractExports(content);
                    summary = `Module at ${modulePath} exports ${exportNames.length} items via ${path.basename(entryFile)}.`;
                    if (exportNames.length) {
                        summary += `\nExports: ${exportNames.join(', ')}`;
                    }
                } else {
                    const files = await fs.readdir(modulePath);
                    summary = `Directory module containing ${files.length} files.`;
                }

                if (args.includeDependencies) {
                    try {
                        dependencies = await collectDependencies(modulePath);
                    } catch (error) {
                        dependencies = [];
                        summary += `\nDependency scan unavailable: ${error instanceof Error ? error.message : String(error)}`;
                    }
                }
            } else {
                summary = `Single file module: ${path.basename(modulePath)}`;
            }
        } catch (e) {
            summary = `Error summarizing module: ${e}`;
        }

        return {
            summary,
            modulePath,
            summaryType: args.summaryType,
            dependencies,
        };
    },
    tags: ['summary', 'module', 'documentation'],
    complexity: 'moderate',
    dependencies: ['summarizer', 'module-analyzer'],
};
