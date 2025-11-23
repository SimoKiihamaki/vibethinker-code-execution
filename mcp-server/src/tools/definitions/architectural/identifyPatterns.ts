import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import type { Dirent } from 'fs';
import { ToolDefinition } from '../../types.js';
import { validatePath, logger } from '../../utils.js';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

type PatternFinding = {
    name: string;
    file: string;
    confidence: 'low' | 'medium' | 'high';
};

type ViolationFinding = {
    name: string;
    file: string;
    message: string;
};

const determineLanguage = (file: string) => {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.ts') return 'TypeScript';
    if (ext === '.tsx') return 'Tsx';
    if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'JavaScript';
    return null;
};

// Extracted pattern detection functions for improved testability and maintainability
const detectSingleton = (
    classInfo: ReturnType<typeof collectClassInfo>,
    filePath: string,
    patterns: PatternFinding[],
    violations: ViolationFinding[],
    includeViolations: boolean
) => {
    const { methods, fields } = classInfo;
    const hasGetter = methods.some(m => m.name === 'getInstance' && m.isStatic);
    const hasPrivateInstance = fields.some(f => f.isStatic && f.accessibility === 'private');

    if (hasGetter && hasPrivateInstance) {
        patterns.push({ name: 'Singleton', file: filePath, confidence: 'high' });
    } else if (includeViolations && hasGetter && !hasPrivateInstance) {
        violations.push({
            name: 'Singleton',
            file: filePath,
            message: 'getInstance() exists but no private static instance field was found.'
        });
    }
};

const detectFactory = (
    classInfo: ReturnType<typeof collectClassInfo>,
    filePath: string,
    patterns: PatternFinding[],
    violations: ViolationFinding[],
    includeViolations: boolean
) => {
    const { methods, name } = classInfo;
    const lowerName = name.toLowerCase();
    const exposesCreate = methods.some(m => m.name.startsWith('create'));

    if (lowerName.includes('factory') || exposesCreate) {
        patterns.push({ name: 'Factory', file: filePath, confidence: exposesCreate ? 'high' : 'medium' });
        if (includeViolations) {
            const usesNew = methods.some(m => /\bnew\s+[A-Z]/.test(m.text));
            if (!usesNew) {
                violations.push({ name: 'Factory', file: filePath, message: 'Factory does not instantiate objects with "new".' });
            }
        }
    }
};

const detectObserver = (
    classInfo: ReturnType<typeof collectClassInfo>,
    filePath: string,
    patterns: PatternFinding[],
    violations: ViolationFinding[],
    includeViolations: boolean
) => {
    const { methods } = classInfo;
    const hasSubscribe = methods.some(m => m.name === 'subscribe');
    const hasNotify = methods.some(m => m.name === 'notify');

    if (hasSubscribe && hasNotify) {
        patterns.push({ name: 'Observer', file: filePath, confidence: 'medium' });
    } else if (includeViolations && (hasSubscribe || hasNotify)) {
        violations.push({ name: 'Observer', file: filePath, message: 'Observer implementation missing subscribe/notify pair.' });
    }
};

const detectController = (
    classInfo: ReturnType<typeof collectClassInfo>,
    filePath: string,
    patterns: PatternFinding[],
    violations: ViolationFinding[],
    includeViolations: boolean
) => {
    const { methods, name } = classInfo;
    const lowerName = name.toLowerCase();

    if (lowerName.endsWith('controller')) {
        patterns.push({ name: 'Controller', file: filePath, confidence: 'high' });
        if (includeViolations) {
            const hasHandler = methods.some(m => ['handle', 'execute'].includes(m.name));
            if (!hasHandler) {
                violations.push({ name: 'Controller', file: filePath, message: 'Controller lacks a handle/execute method.' });
            }
        }
    }
};

const detectService = (
    classInfo: ReturnType<typeof collectClassInfo>,
    filePath: string,
    patterns: PatternFinding[],
    violations: ViolationFinding[],
    includeViolations: boolean
) => {
    const { methods, name } = classInfo;
    const lowerName = name.toLowerCase();

    if (lowerName.endsWith('service')) {
        patterns.push({ name: 'Service', file: filePath, confidence: 'high' });
        const publicMethods = methods.filter(m => m.accessibility !== 'private');
        if (includeViolations && publicMethods.length === 0) {
            violations.push({ name: 'Service', file: filePath, message: 'Service classes should expose at least one public method.' });
        }
    }
};

const detectRepository = (
    classInfo: ReturnType<typeof collectClassInfo>,
    filePath: string,
    patterns: PatternFinding[],
    violations: ViolationFinding[],
    includeViolations: boolean
) => {
    const { methods, name } = classInfo;
    const lowerName = name.toLowerCase();

    if (lowerName.endsWith('repository')) {
        patterns.push({ name: 'Repository', file: filePath, confidence: 'high' });
        if (includeViolations) {
            const hasDataMethods = methods.some(m => ['find', 'save', 'get', 'put'].some(prefix => m.name.startsWith(prefix)));
            if (!hasDataMethods) {
                violations.push({ name: 'Repository', file: filePath, message: 'Repository should expose persistence operations (find/save/etc.).' });
            }
        }
    }
};

const detectMicroservicesPattern = (
    classInfo: ReturnType<typeof collectClassInfo>,
    filePath: string,
    patterns: PatternFinding[]
) => {
    const { name, text } = classInfo;
    const lowerName = name.toLowerCase();
    const serviceLikeName = lowerName.includes('service');
    const serviceMarkers = /express|fastify|grpc|controller/i.test(text);

    if (/services?/i.test(filePath) && (serviceLikeName || serviceMarkers)) {
        patterns.push({ name: 'ServiceModule', file: filePath, confidence: serviceMarkers ? 'high' : 'medium' });
    }
};

const detectDddPattern = (
    classInfo: ReturnType<typeof collectClassInfo>,
    filePath: string,
    patterns: PatternFinding[]
) => {
    const { text } = classInfo;
    const dddMarkers = /(AggregateRoot|DomainEvent|Entity)/.test(text) || /class\s+\w+(Repository|Aggregate|Entity)/.test(text);

    if (/(domain|aggregate)/i.test(filePath) && dddMarkers) {
        patterns.push({ name: 'DDD Component', file: filePath, confidence: 'medium' });
    } else if (dddMarkers) {
        patterns.push({ name: 'DDD Component', file: filePath, confidence: 'low' });
    }
};

const collectClassInfo = (classNode: any) => {
    const body = classNode.children().find((child: any) => child.kind() === 'class_body');
    const methodNodes = body ? body.children().filter((child: any) => child.kind() === 'method_definition') : [];
    const fieldNodes = body ? body.children().filter((child: any) => child.kind().includes('field_definition')) : [];

    const methods = methodNodes.map((method: any) => {
        const nameNode = method.children().find((child: any) => child.kind() === 'property_identifier');
        const isStatic = method.children().some((child: any) => child.kind() === 'static');
        const accessibilityNode = method.children().find((child: any) => child.kind() === 'accessibility_modifier');
        const accessibility = accessibilityNode?.text() ?? 'public';
        return {
            name: nameNode?.text() ?? '',
            isStatic,
            accessibility,
            text: method.text(),
        };
    });

    const fields = fieldNodes.map((field: any) => {
        const nameNode = field.children().find((child: any) => child.kind() === 'property_identifier');
        const modifierNode = field.children().find((child: any) => child.kind() === 'accessibility_modifier');
        const isStatic = field.children().some((child: any) => child.kind() === 'static');
        return {
            name: nameNode?.text() ?? '',
            accessibility: modifierNode?.text(),
            isStatic,
            text: field.text(),
        };
    });

    const name = classNode.field?.('name')?.text?.() ?? classNode.children().find((child: any) => child.kind() === 'type_identifier')?.text() ?? 'AnonymousClass';

    return { name, methods, fields, text: classNode.text() };
};

export const identifyPatterns: ToolDefinition = {
    name: 'identifyPatterns',
    description: 'Identify architectural patterns and design principles',
    category: 'architectural',
    inputSchema: z.object({
        codebase: z.string().describe('Path to codebase to analyze'),
        patternTypes: z.array(z.enum(['design-patterns', 'architectural-patterns', 'microservices', 'ddd'])).default(['design-patterns']),
        includeViolations: z.boolean().default(true).describe('Include pattern violations'),
    }),
    handler: async (args) => {
        const codebase = await validatePath(String(args.codebase || process.cwd()));
        const requestedTypes = args.patternTypes || ['design-patterns'];
        const includeViolations = args.includeViolations ?? true;
        const patterns: PatternFinding[] = [];
        const violations: ViolationFinding[] = [];

        let astGrep: any;
        try {
            astGrep = await import('@ast-grep/napi');
        } catch (error) {
            throw new Error(`Failed to load ast-grep: ${(error as Error).message}`);
        }
        const { parse, Lang } = astGrep;

        const visitedDirs = new Set<string>();

        const analyzeFile = async (filePath: string) => {
            let stats;
            try {
                stats = await fs.stat(filePath);
            } catch (error) {
                logger.debug(`Unable to stat file ${filePath}: ${error}`);
                return;
            }
            if (stats.size > MAX_FILE_SIZE) {
                logger.debug(`Skipping ${filePath} (>${MAX_FILE_SIZE} bytes)`);
                return;
            }

            const langName = determineLanguage(filePath);
            if (!langName) return;

            let content: string;
            try {
                content = await fs.readFile(filePath, 'utf8');
            } catch (error) {
                logger.debug(`Unable to read file ${filePath}: ${error}`);
                return;
            }

            let root;
            try {
                root = parse(Lang[langName as keyof typeof Lang], content).root();
            } catch (error) {
                logger.debug(`ast-grep failed to parse ${filePath}: ${error}`);
                return;
            }

            const classNodes = root.findAll({ rule: { kind: 'class_declaration' } }) || [];
            for (const classNode of classNodes) {
                const classInfo = collectClassInfo(classNode);

                // Design pattern detection
                if (requestedTypes.includes('design-patterns')) {
                    detectSingleton(classInfo, filePath, patterns, violations, includeViolations);
                    detectFactory(classInfo, filePath, patterns, violations, includeViolations);
                    detectObserver(classInfo, filePath, patterns, violations, includeViolations);
                }

                // Architectural pattern detection
                if (requestedTypes.includes('architectural-patterns')) {
                    detectController(classInfo, filePath, patterns, violations, includeViolations);
                    detectService(classInfo, filePath, patterns, violations, includeViolations);
                    detectRepository(classInfo, filePath, patterns, violations, includeViolations);
                }

                // Microservices pattern detection
                if (requestedTypes.includes('microservices')) {
                    detectMicroservicesPattern(classInfo, filePath, patterns);
                }

                // DDD pattern detection
                if (requestedTypes.includes('ddd')) {
                    detectDddPattern(classInfo, filePath, patterns);
                }
            }
        };

        const walk = async (dir: string) => {
            let dirStats;
            try {
                dirStats = await fs.lstat(dir);
            } catch (error) {
                logger.debug(`Unable to lstat directory ${dir}: ${error}`);
                return;
            }
            const realPath = dirStats.isSymbolicLink() ? await fs.realpath(dir).catch(() => dir) : dir;
            if (visitedDirs.has(realPath)) return;
            visitedDirs.add(realPath);

            let entries: Dirent[];
            try {
                entries = await fs.readdir(dir, { withFileTypes: true });
            } catch (error) {
                logger.debug(`Unable to read directory ${dir}: ${error}`);
                return;
            }

            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;
                const fullPath = await validatePath(path.join(dir, entry.name));
                if (entry.isDirectory()) {
                    if (SKIP_DIRS.has(entry.name)) continue;
                    await walk(fullPath);
                } else if (entry.isFile() && /\.(ts|js|tsx|jsx|mjs|cjs)$/.test(entry.name)) {
                    await analyzeFile(fullPath);
                }
            }
        };

        await walk(codebase);

        return {
            patterns,
            violations,
            codebase,
            patternTypes: requestedTypes,
            summary: `Identified ${patterns.length} architectural patterns`
        };
    },
    tags: ['patterns', 'architecture', 'design'],
    complexity: 'complex',
    externalDependencies: [],
    npmDependencies: ['@ast-grep/napi'],
    internalDependencies: [],
};

// Export pattern detection functions for unit testing
export {
    detectSingleton,
    detectFactory,
    detectObserver,
    detectController,
    detectService,
    detectRepository,
    detectMicroservicesPattern,
    detectDddPattern,
    collectClassInfo,
    determineLanguage
};
