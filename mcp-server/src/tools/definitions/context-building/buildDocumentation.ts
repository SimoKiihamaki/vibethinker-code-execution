import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { ToolDefinition } from '../../types.js';
import { validatePath } from '../../utils.js';

export const buildDocumentation: ToolDefinition = {
    name: 'buildDocumentation',
    description: 'Generate comprehensive documentation from code analysis',
    category: 'context-building',
    inputSchema: z.object({
        target: z.string().describe('Target file or directory'),
        docType: z.enum(['api', 'architecture', 'usage', 'comprehensive']).default('comprehensive'),
        includeExamples: z.boolean().default(true).describe('Include code examples'),
    }),
    handler: async (args) => {
        type DocType = 'api' | 'architecture' | 'usage' | 'comprehensive';
        const target = await validatePath(String(args.target));
        const docType = (args.docType ?? 'comprehensive') as DocType;
        const includeExamples = args.includeExamples ?? true;
        const includeApi = docType === 'api' || docType === 'comprehensive';
        const includeArchitecture = docType === 'architecture' || docType === 'comprehensive';
        const includeUsage = docType === 'usage' || docType === 'comprehensive';
        const examples: string[] = [];
        const sections: string[] = [`# Documentation for ${path.basename(target)}\n`];

        try {
            const stat = await fs.stat(target);
            if (stat.isFile()) {
                const content = await fs.readFile(target, 'utf8');

                if (includeApi) {
                    const jsDocs = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
                    if (jsDocs.length > 0) {
                        sections.push('## API Documentation\n');
                        jsDocs.forEach(doc => sections.push(doc.trim(), ''));
                    }

                    const exports = content.match(/export\s+(class|interface|function|const|type)\s+(\w+)/g) || [];
                    if (exports.length > 0) {
                        sections.push('## Exported Symbols\n');
                        exports.forEach(exp => sections.push(`- \`${exp.replace('export ', '')}\``));
                        sections.push('');

                        if (includeExamples) {
                            const firstExport = exports[0].split(/\s+/).pop();
                            if (firstExport) {
                                const relativeImport = path.relative(process.cwd(), target);
                                examples.push(`import { ${firstExport} } from '${relativeImport}';\n${firstExport}(/* params */);`);
                            }
                        }
                    }
                }

                if (includeUsage) {
                    sections.push('## Usage Guidance\n');
                    sections.push('- Review exported symbols above and import only what you need.');
                    sections.push('- Ensure unit tests cover the documented behaviors.');
                    sections.push('');
                }

                if (includeArchitecture) {
                    sections.push('## File Overview\n');
                    sections.push(`- Absolute path: \`${target}\``);
                    sections.push(`- Size: ${(Buffer.byteLength(content, 'utf8') / 1024).toFixed(1)} KB`);
                    sections.push('');
                }
            } else if (stat.isDirectory()) {
                const entries = await fs.readdir(target);
                if (includeArchitecture) {
                    sections.push('## Directory Structure\n');
                    entries
                        .filter(f => !f.startsWith('.'))
                        .slice(0, 50)
                        .forEach(f => sections.push(`- ${f}`));
                    if (entries.length > 50) {
                        sections.push(`- ...and ${entries.length - 50} more entries`);
                    }
                    sections.push('');
                }

                if (includeUsage) {
                    sections.push('## Usage Guidance\n');
                    if (entries.includes('package.json')) {
                        sections.push('- Run `npm install` followed by `npm start` to execute primary workflows.');
                    }
                    sections.push('- Review README files within the directory for setup details.');
                    sections.push('');
                }

                if (includeExamples) {
                    const readme = entries.find(e => /^readme/i.test(e));
                    if (readme) {
                        examples.push(`Refer to ${path.join(target, readme)} for detailed walkthroughs.`);
                    }
                }
            }
        } catch (e) {
            sections.push(`Error generating documentation: ${e}`);
        }

        const response: {
            documentation: string;
            target: string;
            docType: typeof docType;
            examples?: string[];
        } = {
            documentation: sections.join('\n').trimEnd(),
            target,
            docType
        };

        if (includeExamples && examples.length > 0) {
            response.examples = examples;
        }

        return response;
    },
    tags: ['documentation', 'generation', 'comprehensive'],
    complexity: 'complex',
    dependencies: ['doc-generator', 'code-analyzer'],
};
