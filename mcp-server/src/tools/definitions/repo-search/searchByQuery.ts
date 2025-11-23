import { spawn } from 'child_process';
import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { validatePath } from '../../utils.js';

type SnippetLine = {
    type: 'context' | 'match';
    line: number;
    text: string;
};

type RipgrepResult = {
    file: string;
    line: number;
    snippetLines: SnippetLine[];
};

type ToolResult = {
    file: string;
    line: number;
    snippet: string;
};

type RipgrepOptions = {
    query: string;
    root: string;
    fileTypes: string[];
    maxResults: number;
    contextLines: number;
};

const normalizeGlob = (value: string): string => {
    const trimmed = value?.trim();
    if (!trimmed) return '*';
    if (trimmed.startsWith('*')) return trimmed;
    if (trimmed.startsWith('.')) return `*${trimmed}`;
    return trimmed.includes('.') ? `*${trimmed}` : `*.${trimmed}`;
};

const formatSnippet = (lines: SnippetLine[]): string => {
    if (!lines.length) return '';
    return lines
        .map((entry) => `${entry.type === 'match' ? '>' : ' '} ${entry.line}: ${entry.text}`)
        .join('\n')
        .trimEnd();
};

const runRipgrepSearch = ({ query, root, fileTypes, maxResults, contextLines }: RipgrepOptions): Promise<ToolResult[]> => {
    return new Promise((resolve, reject) => {
        const args: string[] = [
            '--no-heading',
            '--line-number',
            '--with-filename',
            '--color',
            'never',
            '-C',
            String(contextLines),
        ];

        for (const type of fileTypes) {
            const pattern = normalizeGlob(type);
            if (pattern && pattern !== '*') {
                args.push('--glob', pattern);
            }
        }

        args.push('-e', query, '.');

        const rg = spawn('rg', args, { cwd: root });
        const matches: RipgrepResult[] = [];
        const beforeContext = new Map<string, SnippetLine[]>();
        const pendingAfter = new Map<number, { file: string; remaining: number }>();

        let buffer = '';
        let stderr = '';
        let stopRequested = false;
        let terminatedEarly = false;
        let settled = false;

        const finish = (results: ToolResult[]) => {
            if (!settled) {
                settled = true;
                resolve(results);
            }
        };

        const fail = (error: Error) => {
            if (!settled) {
                settled = true;
                reject(error);
            }
        };

        const convertResults = () =>
            matches.slice(0, maxResults).map(({ file, line, snippetLines }) => ({
                file,
                line,
                snippet: formatSnippet(snippetLines),
            }));

        const requestStop = () => {
            stopRequested = true;
            if (pendingAfter.size === 0 && !terminatedEarly) {
                terminatedEarly = rg.kill();
            }
        };

        const maybeStop = () => {
            if (stopRequested && pendingAfter.size === 0 && !terminatedEarly) {
                terminatedEarly = rg.kill();
            }
        };

        const handleContextLine = (file: string, lineNumber: number, text: string) => {
            if (contextLines <= 0) return;
            const entry: SnippetLine = { type: 'context', line: lineNumber, text };
            const existing = beforeContext.get(file) ?? [];
            existing.push(entry);
            if (existing.length > contextLines) existing.shift();
            beforeContext.set(file, existing);

            for (const [index, pending] of pendingAfter.entries()) {
                if (pending.file !== file || pending.remaining <= 0) continue;
                matches[index].snippetLines.push({ ...entry });
                pending.remaining -= 1;
                if (pending.remaining === 0) {
                    pendingAfter.delete(index);
                }
            }
            maybeStop();
        };

        const handleMatchLine = (file: string, lineNumber: number, text: string) => {
            if (matches.length >= maxResults) {
                if (!stopRequested) requestStop();
                return;
            }

            const before = contextLines > 0 ? [...(beforeContext.get(file) ?? [])] : [];
            const snippetLines: SnippetLine[] = before.map((entry) => ({ ...entry }));
            snippetLines.push({ type: 'match', line: lineNumber, text });
            matches.push({ file, line: lineNumber, snippetLines });

            if (contextLines > 0) {
                beforeContext.set(file, []);
                pendingAfter.set(matches.length - 1, { file, remaining: contextLines });
            }

            if (matches.length >= maxResults) {
                requestStop();
            }
        };

        const handleLine = (line: string) => {
            if (!line || line === '--') return;
            const normalized = line.replace(/\r$/, '');
            const parts = normalized.match(/^(.+?)([:-])(\d+)([:-])(.*)$/);
            if (!parts) return;

            const [, file, delimiter, lineNumberRaw, , contentRaw] = parts;
            const lineNumber = Number(lineNumberRaw);
            const content = contentRaw ?? '';

            if (delimiter === ':') {
                handleMatchLine(file, lineNumber, content);
            } else if (delimiter === '-') {
                handleContextLine(file, lineNumber, content);
            }
        };

        const processBuffer = () => {
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);
                handleLine(line);
            }
        };

        rg.stdout.on('data', (chunk) => {
            buffer += chunk.toString();
            processBuffer();
        });

        rg.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        rg.on('error', (error) => {
            fail(error);
        });

        rg.on('close', (code, signal) => {
            if (buffer.length) {
                handleLine(buffer);
                buffer = '';
            }

            if (settled) return;

            if (code === 0 || code === 1 || terminatedEarly || signal) {
                finish(convertResults());
            } else {
                fail(new Error(stderr.trim() || `ripgrep exited with code ${code ?? 'unknown'}`));
            }
        });
    });
};

export const searchByQuery: ToolDefinition = {
    name: 'searchByQuery',
    description: 'Search repository by natural language query using ripgrep and semantic understanding',
    category: 'repo-search',
    inputSchema: z.object({
        query: z.string().describe('Natural language search query'),
        fileTypes: z.array(z.string()).optional().describe('File extensions to search (e.g., [".ts", ".tsx"])'),
        maxResults: z.number().int().min(1).max(100).default(20).describe('Maximum number of results'),
        contextLines: z.number().int().min(0).max(10).default(3).describe('Lines of context around matches'),
    }),
    handler: async (args) => {
        const query = String(args.query ?? '').trim();
        if (!query) return { summary: 'Empty query provided', results: [] };

        const root = await validatePath(process.cwd());
        const types = Array.isArray(args.fileTypes) && args.fileTypes.length ? args.fileTypes : ['.ts', '.tsx', '.js', '.jsx'];
        const max = typeof args.maxResults === 'number' ? args.maxResults : 20;
        const ctx = typeof args.contextLines === 'number' ? args.contextLines : 3;

        try {
            const results = await runRipgrepSearch({
                query,
                root,
                fileTypes: types,
                maxResults: max,
                contextLines: ctx,
            });

            return { summary: `Found ${results.length} matches`, results };
        } catch (error) {
            return { summary: 'Search failed (ripgrep error)', results: [], error: error instanceof Error ? error.message : String(error) };
        }
    },
    tags: ['search', 'ripgrep', 'semantic'],
    complexity: 'moderate',
    externalDependencies: ['ripgrep'],
    internalDependencies: [],
};
