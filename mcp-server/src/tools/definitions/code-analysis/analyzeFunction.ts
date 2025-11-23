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
    }),
    handler: async (args) => {
        try {
            const file = await validatePath(String(args.filePath));
            const content = await fs.readFile(file, 'utf8');

            // Initialize ast-grep
            let sg: any;
            try {
                const { parse, Lang } = await import('@ast-grep/napi');
                const lang = file.endsWith('.tsx') ? Lang.Tsx : file.endsWith('.ts') ? Lang.TypeScript : Lang.JavaScript;
                sg = parse(lang, content);
            } catch (e) {
                throw new Error(`Failed to initialize ast-grep: ${e}`);
            }

            const root = sg.root();
            const targetName = String(args.functionName);

            // Find function definition using structurally driven rules
            // Try function declaration
            let node = root.find({
                rule: {
                    kind: 'function_declaration',
                    has: {
                        field: 'name',
                        regex: `^${targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
                    }
                }
            });

            // Try variable declarator (let/const/var function assignments)
            if (!node) {
                const escapedName = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                node = root.find({
                    rule: {
                        kind: 'variable_declarator',
                        has: {
                            field: 'name',
                            regex: `^${escapedName}$`
                        },
                        has: {
                            kind: 'arrow_function'
                        }
                    }
                });
            }

            // Try method definition in class/object
            if (!node) {
                const escapedName = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                node = root.find({
                    rule: {
                        kind: 'method_definition',
                        has: {
                            field: 'name',
                            regex: `^${escapedName}$`
                        }
                    }
                });
            }

            // Try property with arrow function in object literal
            if (!node) {
                const escapedName = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                node = root.find({
                    rule: {
                        kind: 'pair',
                        has: {
                            field: 'key',
                            regex: `^${escapedName}$`
                        },
                        has: {
                            kind: 'arrow_function'
                        }
                    }
                });
            }

            // Try function expression assignment
            if (!node) {
                const escapedName = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                node = root.find({
                    rule: {
                        kind: 'assignment_expression',
                        has: {
                            field: 'left',
                            regex: `^${escapedName}$`
                        },
                        has: {
                            kind: 'function'
                        }
                    }
                });
            }

            if (!node) {
                return {
                    function: { name: targetName, found: false },
                    analysis: {},
                    filePath: args.filePath,
                    functionName: targetName,
                };
            }

            const { start, end } = node.range();
            const functionBody = node.text();
            const lines = functionBody.split('\n').length;

            // Calculate cyclomatic complexity (control flow branches only)
            const branches =
                node.findAll({ rule: { kind: 'if_statement' } }).length +
                node.findAll({ rule: { kind: 'for_statement' } }).length +
                node.findAll({ rule: { kind: 'while_statement' } }).length +
                node.findAll({ rule: { kind: 'switch_case' } }).length +
                node.findAll({ rule: { kind: 'catch_clause' } }).length +
                node.findAll({ rule: { kind: 'conditional_expression' } }).length;

            // Count formal parameters by traversing parameter list nodes
            const paramList = node.find({ rule: { kind: 'formal_parameters' } });
            const params = paramList ? paramList.findAll({ rule: { kind: 'required_parameter' } }).length +
                                       paramList.findAll({ rule: { kind: 'optional_parameter' } }).length : 0;

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
                filePath: args.filePath,
                functionName: args.functionName,
            };
        }
    },
    tags: ['function', 'analysis', 'complexity'],
    complexity: 'moderate',
    externalDependencies: [],
    npmDependencies: ['@ast-grep/napi'],
    internalDependencies: ['../../utils.js:validatePath'],
};
