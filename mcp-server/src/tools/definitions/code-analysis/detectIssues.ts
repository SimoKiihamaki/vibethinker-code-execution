import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition } from '../../types.js';
import { validatePath, logger } from '../../utils.js';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

type IssueType = 'bugs' | 'code-smells' | 'security' | 'performance';

type Detector = {
    type: IssueType;
    regex: RegExp;
    message: string;
    severity: 'low' | 'medium' | 'high';
};

const DETECTORS: Detector[] = [
    { type: 'code-smells', regex: /TODO|FIXME/, message: 'Unresolved TODO/FIXME comment', severity: 'low' },
    { type: 'code-smells', regex: /\bvar\b/, message: 'Use let/const instead of var', severity: 'medium' },
    { type: 'code-smells', regex: /\bconsole\.log\b/, message: 'console.log detected in source', severity: 'low' },
    { type: 'bugs', regex: /(?<![=!])==(?![=])/, message: 'Loose equality used; prefer ===', severity: 'medium' },
    { type: 'bugs', regex: /catch\s*\(\s*[A-Za-z0-9_$]+\s*\)\s*{\s*(?:\/\/[^\n]*\n|\s)*}/si, message: 'Empty catch block detected', severity: 'medium' },
    { type: 'security', regex: /\beval\s*\(/, message: 'Avoid eval() for security reasons', severity: 'high' },
    { type: 'security', regex: /dangerouslySetInnerHTML/, message: 'dangerouslySetInnerHTML usage detected', severity: 'high' },
    { type: 'performance', regex: /\bsleep\(/, message: 'Blocking sleep call detected', severity: 'low' },
    { type: 'performance', regex: /setInterval\(/, message: 'setInterval detected without cancellation', severity: 'low' },
];

let astGrepModule: any | null = null;

const loadAstGrep = async () => {
    if (astGrepModule) return astGrepModule;
    try {
        astGrepModule = await import('@ast-grep/napi');
    } catch {
        astGrepModule = null;
    }
    return astGrepModule;
};

export const detectIssues: ToolDefinition = {
    name: 'detectIssues',
    description: 'Detect potential issues, bugs, and code smells',
    category: 'code-analysis',
    inputSchema: z.object({
        target: z.string().describe('File or directory to analyze'),
        issueTypes: z.array(z.enum(['bugs', 'code-smells', 'security', 'performance'])).default(['bugs', 'code-smells']),
        confidence: z.enum(['low', 'medium', 'high']).default('medium'),
    }),
    handler: async (args) => {
        const issues: Array<{ type: IssueType; message: string; file: string; line?: number; severity: string; confidence: string }> = [];
        const target = await validatePath(String(args.target));
        const requestedTypes = new Set<IssueType>((args.issueTypes || ['bugs', 'code-smells']) as IssueType[]);
        const confidence = args.confidence ?? 'medium';

        const detectors = DETECTORS.filter(detector => requestedTypes.has(detector.type));

        const analyzeFile = async (filePath: string) => {
            try {
                const content = await fs.readFile(filePath, 'utf8');

                if (requestedTypes.has('bugs')) {
                    const sg = await loadAstGrep();
                    if (sg) {
                        try {
                            const ext = path.extname(filePath).toLowerCase();
                            const lang = ext === '.ts' ? sg.Lang.TypeScript : sg.Lang.JavaScript;
                            const root = sg.parse(lang, content).root();
                            const loosePattern = sg.pattern(lang, '$A == $B');
                            const matches = root.findAll(loosePattern);
                            for (const node of matches) {
                                const line = node.range().start.line + 1;
                                issues.push({
                                    type: 'bugs',
                                    message: 'Loose equality used; prefer ===',
                                    file: filePath,
                                    line,
                                    severity: 'medium',
                                    confidence,
                                });
                            }
                        } catch (error) {
                            logger.debug(`ast-grep loose equality detection failed for ${filePath}: ${error}`);
                        }
                    }
                }
                for (const detector of detectors) {
                    const flags = detector.regex.flags.includes('g') ? detector.regex.flags : `${detector.regex.flags}g`;
                    const regex = new RegExp(detector.regex.source, flags);
                    let match: RegExpExecArray | null;
                    while ((match = regex.exec(content))) {
                        const prior = content.slice(0, match.index ?? 0);
                        const line = prior.split(/\r?\n/).length;
                        issues.push({
                            type: detector.type,
                            message: detector.message,
                            file: filePath,
                            line,
                            severity: detector.severity,
                            confidence,
                        });
                        if (match[0].length === 0) {
                            regex.lastIndex++;
                        }
                    }
                }
            } catch (error) {
                logger.debug(`Failed to read ${filePath}: ${error}`);
            }
        };

        const walk = async (currentPath: string) => {
            let stats;
            try {
                stats = await fs.stat(currentPath);
            } catch (error) {
                logger.debug(`Failed to stat ${currentPath}: ${error}`);
                return;
            }

            if (stats.isDirectory()) {
                const entries = await fs.readdir(currentPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name.startsWith('.')) continue;
                    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
                    const located = await validatePath(path.join(currentPath, entry.name));
                    if (entry.isDirectory()) {
                        await walk(located);
                    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
                        await analyzeFile(located);
                    }
                }
            } else if (stats.isFile()) {
                await analyzeFile(currentPath);
            }
        };

        await walk(target);

        return {
            issues,
            target,
            issueTypes: Array.from(requestedTypes),
            confidence,
        };
    },
    tags: ['issues', 'bugs', 'code-smells'],
    complexity: 'complex',
    dependencies: ['issue-detector', 'static-analyzer'],
};
