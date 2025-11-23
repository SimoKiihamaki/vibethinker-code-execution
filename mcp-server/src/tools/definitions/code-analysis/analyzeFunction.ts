import { z } from 'zod';
import fs from 'fs/promises';
import { ToolDefinition } from '../../types.js';
import { validatePath } from '../../utils.js';

export const analyzeFunction: ToolDefinition = {
    name: 'analyzeFunction',
    description: 'Analyze specific function or method for complexity and best practices',
    category: 'code-analysis',
    inputSchema: z.object({
        filePath: z.string().describe('File containing the function'),
        functionName: z.string().describe('Name of the function to analyze'),
        includeCallers: z.boolean().default(false).describe('Include function callers'),
        includeCallees: z.boolean().default(false).describe('Include functions called by this one'),
    }),
    handler: async (args) => {
        try {
            const file = await validatePath(String(args.filePath));
            const content = await fs.readFile(file, 'utf8');

            // Initialize ast-grep
            let sg: any;
            try {
                const { parse } = await import('@ast-grep/napi');
                const lang = file.endsWith('.tsx') ? 'tsx' : file.endsWith('.ts') ? 'typescript' : 'javascript';
                sg = parse(lang, content);
            } catch (e) {
                throw new Error(`Failed to initialize ast-grep: ${e}`);
            }

            const root = sg.root();
            const targetName = String(args.functionName);

            // Find function definition using rule objects to avoid pattern parsing errors
            // Try function declaration
            let node = root.find({
                rule: {
                    kind: 'function_declaration',
                    pattern: `function ${targetName}($$$) { $$$ }`
                }
            });

            // Try arrow function assignment
            if (!node) {
                node = root.find({
                    rule: {
                        kind: 'variable_declarator',
                        pattern: `const ${targetName} = ($$$) => { $$$ }`
                    }
                });
            }

            // Try method definition
            if (!node) {
                node = root.find({
                    rule: {
                        kind: 'method_definition',
                        has: {
                            field: 'name',
                            regex: `^${targetName}$`
                        }
                    }
                });
            }

            if (!node) {
                return {
                    function: { name: targetName, found: false },
                    analysis: {},
                    filePath: args.filePath
                };
            }

            const { start, end } = node.range();
            const functionBody = node.text();
            const lines = functionBody.split('\n').length;

            // Calculate complexity (simple approximation)
            // Use kind-based matching for elements that aren't valid standalone code (like catch/case)
            const branches = node.findAll('if ($$$) { $$$ }').length +
                node.findAll('for ($$$) { $$$ }').length +
                node.findAll('while ($$$) { $$$ }').length +
                node.findAll({ rule: { kind: 'switch_case' } }).length +
                node.findAll({ rule: { kind: 'catch_clause' } }).length +
                node.findAll('$A && $B').length +
                node.findAll('$A || $B').length;

            const params = node.find('($$$)')?.text().split(',').filter((p: string) => p.trim()).length || 0;

            return {
                function: {
                    name: targetName,
                    found: true,
                    line: start.line + 1,
                    endLine: end.line + 1
                },
                analysis: {
                    complexity: { cyclomatic: branches + 1 },
                    lines,
                    params
                },
                filePath: args.filePath,
                functionName: targetName,
            };
        } catch (error) {
            return {
                function: { name: args.functionName, found: false },
                analysis: {},
                error: String(error),
                filePath: args.filePath
            };
        }
    },
    tags: ['function', 'analysis', 'complexity'],
    complexity: 'moderate',
    dependencies: ['ast-grep', 'function-analyzer'],
};
