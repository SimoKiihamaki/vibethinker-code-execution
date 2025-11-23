import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition } from '../../types.js';
import { validatePath, logger } from '../../utils.js';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

interface Violation {
    type: string;
    message: string;
    file: string;
    severity: string;
}

interface PatternSummary {
    name: string;
    count: number;
}

export const findPatterns: ToolDefinition = {
    name: 'findPatterns',
    description: 'Find code patterns, anti-patterns, and best practice violations',
    category: 'code-analysis',
    inputSchema: z.object({
        directory: z.string().describe('Directory to search'),
        patternTypes: z.array(z.enum(['anti-patterns', 'best-practices', 'security', 'performance'])).default(['anti-patterns']),
        severity: z.enum(['low', 'medium', 'high']).default('medium'),
    }),
    handler: async (args) => {
        const violations: Violation[] = [];
        const patternSummaries: PatternSummary[] = [];
        const dirRoot = await validatePath(String(args.directory));
        const patternCounts: Record<string, number> = {};

        let astGrep: any;
        try {
            astGrep = await import('@ast-grep/napi');
        } catch (e) {
            logger.warn(`ast-grep failed to load: ${e}`);
        }

        async function walk(dir: string) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const e of entries) {
                    const p = path.join(dir, e.name);
                    if (e.isDirectory()) {
                        if (SKIP_DIRS.has(e.name)) continue;
                        await walk(p);
                    } else if (e.isFile() && /\.(ts|js|tsx|jsx)$/.test(e.name)) {
                        const content = await fs.readFile(p, 'utf8');

                        if (astGrep) {
                            try {
                                const langName = p.endsWith('.tsx')
                                    ? 'Tsx'
                                    : p.endsWith('.ts')
                                        ? 'TypeScript'
                                        : 'JavaScript';
                                const root = astGrep.parse(astGrep.Lang[langName], content).root();
                                const langEnum = astGrep.Lang[langName];
                                const evalPattern = astGrep.pattern(langEnum, 'eval($EXPR)');
                                const consolePattern = astGrep.pattern(langEnum, 'console.log($ARG)');
                                const varPattern = astGrep.pattern(langEnum, 'var $NAME = $VALUE');
                                const dangerouslyPattern = astGrep.pattern(langEnum, 'dangerouslySetInnerHTML={$VALUE}');

                                // Security checks
                                if (args.patternTypes.includes('security')) {
                                    if (root.find(evalPattern)) {
                                        violations.push({ type: 'security', message: 'eval() usage detected', file: p, severity: 'high' });
                                        patternCounts['security:eval'] = (patternCounts['security:eval'] || 0) + 1;
                                    }
                                    if (root.find(dangerouslyPattern)) {
                                        violations.push({ type: 'security', message: 'dangerouslySetInnerHTML usage', file: p, severity: 'medium' });
                                        patternCounts['security:dangerouslySetInnerHTML'] = (patternCounts['security:dangerouslySetInnerHTML'] || 0) + 1;
                                    }
                                }

                                // Best practices
                                if (args.patternTypes.includes('best-practices')) {
                                    if (root.find(consolePattern)) {
                                        violations.push({ type: 'best-practice', message: 'console.log usage', file: p, severity: 'low' });
                                        patternCounts['best-practices:console.log'] = (patternCounts['best-practices:console.log'] || 0) + 1;
                                    }
                                }

                                // Anti-patterns
                                if (args.patternTypes.includes('anti-patterns')) {
                                    if (root.find(varPattern)) {
                                        violations.push({ type: 'anti-pattern', message: 'var usage', file: p, severity: 'medium' });
                                        patternCounts['anti-patterns:var'] = (patternCounts['anti-patterns:var'] || 0) + 1;
                                    }
                                }

                            } catch (parseError) {
                                logger.debug(`ast-grep failed on ${p}: ${parseError}`);
                            }
                        } else {
                            // Fallback regex checks, still honoring patternTypes and patternCounts
                            if (args.patternTypes.includes('security') && content.includes('eval(')) {
                                violations.push({ type: 'security', message: 'eval() usage', file: p, severity: 'high' });
                                patternCounts['security:eval'] = (patternCounts['security:eval'] || 0) + 1;
                            }
                            if (args.patternTypes.includes('best-practices') && content.includes('console.log')) {
                                violations.push({ type: 'best-practice', message: 'console.log usage', file: p, severity: 'low' });
                                patternCounts['best-practices:console.log'] = (patternCounts['best-practices:console.log'] || 0) + 1;
                            }
                            if (args.patternTypes.includes('anti-patterns') && content.includes('var ')) {
                                violations.push({ type: 'anti-pattern', message: 'var usage', file: p, severity: 'medium' });
                                patternCounts['anti-patterns:var'] = (patternCounts['anti-patterns:var'] || 0) + 1;
                            }
                        }
                    }
                }
            } catch (e) {
                logger.debug(`Failed to analyze patterns in directory: ${e}`);
            }
        }

        await walk(dirRoot);

        patternSummaries.push(...Object.entries(patternCounts).map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20));

        return {
            patterns: patternSummaries,
            violations,
            directory: dirRoot,
            patternTypes: args.patternTypes,
        };
    },
    tags: ['patterns', 'anti-patterns', 'best-practices'],
    complexity: 'complex',
    externalDependencies: [],
    npmDependencies: ['@ast-grep/napi'],
    internalDependencies: [],
};
