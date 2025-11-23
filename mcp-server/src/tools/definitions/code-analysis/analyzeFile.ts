import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition } from '../../types.js';
import { validatePath, logger } from '../../utils.js';

export const analyzeFile: ToolDefinition = {
    name: 'analyzeFile',
    description: 'Deep analysis of a single file including complexity, patterns, and issues',
    category: 'code-analysis',
    inputSchema: z.object({
        filePath: z.string().describe('Path to the file to analyze'),
        analysisType: z.enum(['full', 'complexity', 'patterns', 'issues']).default('full'),
        includeSuggestions: z.boolean().default(true).describe('Include improvement suggestions'),
    }),
    handler: async (args) => {
        const file = await validatePath(String(args.filePath));
        const analysisType = typeof args.analysisType === 'string' ? args.analysisType : 'full';
        const includeSuggestions = typeof args.includeSuggestions === 'boolean' ? args.includeSuggestions : true;

        let content = '';
        try {
            content = await fs.readFile(file, 'utf8');
        } catch (error) {
            logger.warn(`Failed to read file ${file}: ${error instanceof Error ? error.message : String(error)}`);
            return { summary: 'File not found', metrics: { complexity: 0, lines: 0, functions: 0 }, findings: [], actions: [] };
        }

        // Initialize ast-grep
        let sg;
        try {
            const { parse, Lang } = await import('@ast-grep/napi');
            const ext = path.extname(file).toLowerCase();
            let selectedLang = Lang.JavaScript;
            if (ext === '.tsx') selectedLang = Lang.Tsx;
            else if (ext === '.ts') selectedLang = Lang.TypeScript;
            sg = parse(selectedLang, content);
        } catch (e) {
            logger.warn(`ast-grep failed, falling back to regex: ${e instanceof Error ? e.message : String(e)}`);
        }

        const lines = content.split(/\r?\n/);
        let functionCount = 0;
        const findings: Array<{ type: string; file: string; line: number; details: string }> = [];
        let complexity: number;

        if (sg) {
            const root = sg.root();

            // Count functions
            const functions = root.findAll('function $NAME($PARAMS) { $$$ }');
            const arrowFunctions = root.findAll('const $NAME = ($PARAMS) => { $$$ }');
            const methods = root.findAll({ rule: { kind: 'method_definition' } });
            functionCount = functions.length + arrowFunctions.length + methods.length;

            // Calculate complexity (Cyclomatic Complexity approximation)
            const branches =
                root.findAll('if ($COND) { $$$ }').length +
                root.findAll('for ($INIT; $COND; $STEP) { $$$ }').length +
                root.findAll('for ($ITEM of $ITERABLE) { $$$ }').length +
                root.findAll('while ($COND) { $$$ }').length +
                root.findAll('switch ($EXPR) { $$$ }').length +
                root.findAll('try { $$$ } catch ($ERR) { $$$ }').length;
            complexity = branches + 1;

            // Find patterns/issues using structural search
            if (analysisType === 'patterns' || analysisType === 'full' || analysisType === 'issues') {
                const consoles = root.findAll('console.log($$$)');
                for (const node of consoles) {
                    const { line } = node.range().start;
                    findings.push({ type: 'code_smell', file, line: line + 1, details: 'console.log detected' });
                }

                const todos = root.findAll('// TODO: $$$');
                // ast-grep might not catch comments easily with standard patterns, so regex is still useful for comments
            }
        } else {
            // Regex fallback
            const funcMatches = content.match(/function\s+\w+|\w+\s*=\s*\(/g) || [];
            functionCount = funcMatches.length;
            complexity = (content.match(/if\s*\(|for\s*\(|while\s*\(|case\s+|catch\s*\(/g) || []).length + 1;
        }

        // Regex for comments (ast-grep comment support varies)
        if (analysisType === 'patterns' || analysisType === 'full') {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.includes('TODO:') || line.includes('FIXME:')) {
                    findings.push({ type: 'todo_comment', file, line: i + 1, details: 'TODO/FIXME comment found' });
                }
            }
        }

        // Additional regex checks for things ast-grep might miss or for simple text search
        if (analysisType === 'issues' || analysisType === 'full') {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (/var\s+/.test(line)) {
                    findings.push({ type: 'legacy_syntax', file, line: i + 1, details: 'var usage detected' });
                }
            }
        }

        // Generate actions based on suggestions flag
        const actions = includeSuggestions && findings.length ?
            findings.map(f => {
                if (f.type === 'code_smell') return 'Remove console.log in production';
                if (f.type === 'legacy_syntax') return 'Consider using const/let instead of var';
                if (f.type === 'todo_comment') return 'Address TODO/FIXME comments';
                return 'Review identified issues';
            }).filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
            : [];

        return {
            summary: 'File analyzed',
            metrics: {
                complexity,
                lines: lines.length,
                functions: functionCount,
                findings: findings.length
            },
            findings,
            actions
        };
    },
    tags: ['analysis', 'file', 'complexity'],
    complexity: 'moderate',
    externalDependencies: [],
    npmDependencies: ['ast-grep'],
    internalDependencies: [],
};
