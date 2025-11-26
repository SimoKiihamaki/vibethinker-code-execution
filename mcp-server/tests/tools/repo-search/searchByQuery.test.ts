/**
 * searchByQuery.ts Unit Tests
 *
 * Tests for the ripgrep-based search tool
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Store mock references that persist across calls
let mockStdout: EventEmitter;
let mockStderr: EventEmitter;
let mockProcess: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: ReturnType<typeof vi.fn> };

// Initialize mocks before any test runs
const initMocks = () => {
  mockStdout = new EventEmitter();
  mockStderr = new EventEmitter();
  mockProcess = Object.assign(new EventEmitter(), {
    stdout: mockStdout,
    stderr: mockStderr,
    kill: vi.fn(() => true),
  });
};

// Initialize immediately
initMocks();

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    // Create fresh mock for each spawn call
    initMocks();
    return mockProcess;
  }),
}));

// Mock validatePath to bypass repository root check
vi.mock('../../../src/tools/utils.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/tools/utils.js')>();
  return {
    ...original,
    validatePath: vi.fn().mockImplementation(async (p: string) => p || '/mock/repo'),
  };
});

import { spawn } from 'child_process';
import { validatePath } from '../../../src/tools/utils.js';
import { searchByQuery } from '../../../src/tools/definitions/repo-search/searchByQuery.js';

describe('searchByQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Metadata', () => {
    it('should have correct name', () => {
      expect(searchByQuery.name).toBe('searchByQuery');
    });

    it('should have correct category', () => {
      expect(searchByQuery.category).toBe('repo-search');
    });

    it('should have description', () => {
      expect(searchByQuery.description).toContain('ripgrep');
    });

    it('should have required schema properties', () => {
      const schema = searchByQuery.inputSchema;
      expect(schema).toBeDefined();
    });

    it('should list ripgrep as external dependency', () => {
      expect(searchByQuery.externalDependencies).toContain('ripgrep');
    });

    it('should have appropriate tags', () => {
      expect(searchByQuery.tags).toContain('search');
      expect(searchByQuery.tags).toContain('ripgrep');
    });

    it('should have moderate complexity', () => {
      expect(searchByQuery.complexity).toBe('moderate');
    });
  });

  describe('Handler - Empty Query', () => {
    it('should return empty results for empty query string', async () => {
      const result = await searchByQuery.handler({ query: '' });
      expect(result).toEqual({
        summary: 'Empty query provided',
        results: [],
      });
    });

    it('should return empty results for whitespace-only query', async () => {
      const result = await searchByQuery.handler({ query: '   ' });
      expect(result).toEqual({
        summary: 'Empty query provided',
        results: [],
      });
    });

    it('should return empty results for undefined query', async () => {
      const result = await searchByQuery.handler({});
      expect(result).toEqual({
        summary: 'Empty query provided',
        results: [],
      });
    });
  });

  describe('Handler - Ripgrep Invocation', () => {
    it('should spawn ripgrep with correct base arguments', async () => {
      const handlerPromise = searchByQuery.handler({ query: 'testQuery' });

      // Simulate immediate close with no results
      setImmediate(() => {
        mockProcess.emit('close', 1, null);
      });

      await handlerPromise;

      expect(spawn).toHaveBeenCalled();
      const spawnCall = vi.mocked(spawn).mock.calls[0];
      const args = spawnCall[1] as string[];

      expect(spawnCall[0]).toBe('rg');
      expect(args).toContain('--no-heading');
      expect(args).toContain('--line-number');
      expect(args).toContain('--with-filename');
      expect(args).toContain('--color');
      expect(args).toContain('never');
    });

    it('should include query in ripgrep arguments', async () => {
      const handlerPromise = searchByQuery.handler({ query: 'findThis' });

      setImmediate(() => {
        mockProcess.emit('close', 1, null);
      });

      await handlerPromise;

      expect(spawn).toHaveBeenCalledWith(
        'rg',
        expect.arrayContaining(['-e', 'findThis']),
        expect.any(Object)
      );
    });

    it('should use default file types when not specified', async () => {
      const handlerPromise = searchByQuery.handler({ query: 'test' });

      setImmediate(() => {
        mockProcess.emit('close', 1, null);
      });

      await handlerPromise;

      const spawnCall = vi.mocked(spawn).mock.calls[0];
      const args = spawnCall[1] as string[];

      // Default types are .ts, .tsx, .js, .jsx
      expect(args).toContain('--glob');
      expect(args.some(a => a.includes('.ts'))).toBe(true);
    });

    it('should use custom file types when specified', async () => {
      const handlerPromise = searchByQuery.handler({
        query: 'test',
        fileTypes: ['.py', '.md'],
      });

      setImmediate(() => {
        mockProcess.emit('close', 1, null);
      });

      await handlerPromise;

      const spawnCall = vi.mocked(spawn).mock.calls[0];
      const args = spawnCall[1] as string[];

      expect(args).toContain('*.py');
      expect(args).toContain('*.md');
    });

    it('should include context lines argument', async () => {
      const handlerPromise = searchByQuery.handler({
        query: 'test',
        contextLines: 5,
      });

      setImmediate(() => {
        mockProcess.emit('close', 1, null);
      });

      await handlerPromise;

      const spawnCall = vi.mocked(spawn).mock.calls[0];
      const args = spawnCall[1] as string[];

      expect(args).toContain('-C');
      expect(args).toContain('5');
    });
  });

  describe('Handler - Result Parsing', () => {
    it('should parse single match result', async () => {
      const handlerPromise = searchByQuery.handler({ query: 'test' });

      setImmediate(() => {
        mockStdout.emit('data', 'src/file.ts:10:const test = "value";\n');
        mockProcess.emit('close', 0, null);
      });

      const result = await handlerPromise;

      expect(result.summary).toContain('1 match');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].file).toBe('src/file.ts');
      expect(result.results[0].line).toBe(10);
    });

    it('should parse multiple match results', async () => {
      const handlerPromise = searchByQuery.handler({ query: 'test' });

      setImmediate(() => {
        mockStdout.emit(
          'data',
          'src/a.ts:1:test one\nsrc/b.ts:2:test two\nsrc/c.ts:3:test three\n'
        );
        mockProcess.emit('close', 0, null);
      });

      const result = await handlerPromise;

      expect(result.summary).toContain('3 match');
      expect(result.results).toHaveLength(3);
    });

    it('should respect maxResults limit', async () => {
      const handlerPromise = searchByQuery.handler({
        query: 'test',
        maxResults: 2,
      });

      setImmediate(() => {
        mockStdout.emit(
          'data',
          'src/a.ts:1:test one\nsrc/b.ts:2:test two\nsrc/c.ts:3:test three\n'
        );
        mockProcess.emit('close', 0, null);
      });

      const result = await handlerPromise;

      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('should handle context lines in output', async () => {
      const handlerPromise = searchByQuery.handler({
        query: 'test',
        contextLines: 1,
      });

      setImmediate(() => {
        // Context line format uses '-' delimiter
        mockStdout.emit('data', 'src/file.ts-9-context before\n');
        mockStdout.emit('data', 'src/file.ts:10:const test = "value";\n');
        mockStdout.emit('data', 'src/file.ts-11-context after\n');
        mockProcess.emit('close', 0, null);
      });

      const result = await handlerPromise;

      expect(result.results).toHaveLength(1);
      expect(result.results[0].snippet).toContain('context before');
      expect(result.results[0].snippet).toContain('test');
    });

    it('should handle empty results', async () => {
      const handlerPromise = searchByQuery.handler({ query: 'nonexistent' });

      setImmediate(() => {
        mockProcess.emit('close', 1, null); // exit code 1 = no matches
      });

      const result = await handlerPromise;

      expect(result.summary).toContain('0 match');
      expect(result.results).toHaveLength(0);
    });
  });

  describe('Handler - Error Handling', () => {
    it('should handle ripgrep spawn error', async () => {
      const handlerPromise = searchByQuery.handler({ query: 'test' });

      setImmediate(() => {
        mockProcess.emit('error', new Error('spawn rg ENOENT'));
      });

      const result = await handlerPromise;

      expect(result.summary).toContain('failed');
      expect(result.results).toEqual([]);
      expect(result.error).toBeDefined();
    });

    it('should handle ripgrep stderr output', async () => {
      const handlerPromise = searchByQuery.handler({ query: 'test' });

      setImmediate(() => {
        mockStderr.emit('data', 'rg: error reading file');
        mockProcess.emit('close', 2, null);
      });

      const result = await handlerPromise;

      expect(result.summary).toContain('failed');
      expect(result.error).toContain('error reading file');
    });

    it('should handle malformed output gracefully', async () => {
      const handlerPromise = searchByQuery.handler({ query: 'test' });

      setImmediate(() => {
        mockStdout.emit('data', 'not-valid-ripgrep-output\n');
        mockStdout.emit('data', '--\n');
        mockStdout.emit('data', 'also-invalid\n');
        mockProcess.emit('close', 0, null);
      });

      const result = await handlerPromise;

      // Should not throw, just return empty results
      expect(result.results).toHaveLength(0);
    });
  });

  describe('Handler - Path Validation', () => {
    it('should call validatePath with current working directory', async () => {
      const handlerPromise = searchByQuery.handler({ query: 'test' });

      setImmediate(() => {
        mockProcess.emit('close', 1, null);
      });

      await handlerPromise;

      expect(validatePath).toHaveBeenCalledWith(process.cwd());
    });
  });
});

describe('normalizeGlob Helper', () => {
  // We can't directly import the helper since it's not exported,
  // but we can test it indirectly through the spawn call arguments

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should normalize file extensions through spawn calls', async () => {
    // Test .ts -> *.ts
    const handlerPromise = searchByQuery.handler({
      query: 'test',
      fileTypes: ['.ts'],
    });

    setImmediate(() => {
      mockProcess.emit('close', 1, null);
    });

    await handlerPromise;

    const spawnCall = vi.mocked(spawn).mock.calls[0];
    const args = spawnCall[1] as string[];
    expect(args).toContain('*.ts');
  });

  it('should handle glob patterns starting with asterisk', async () => {
    vi.clearAllMocks();

    const handlerPromise = searchByQuery.handler({
      query: 'test',
      fileTypes: ['*.json'],
    });

    setImmediate(() => {
      mockProcess.emit('close', 1, null);
    });

    await handlerPromise;

    const spawnCall = vi.mocked(spawn).mock.calls[0];
    const args = spawnCall[1] as string[];
    // The normalizeGlob function returns the pattern as-is if it starts with *
    expect(args.join(' ')).toContain('*.json');
  });

  it('should handle extensions without dots', async () => {
    vi.clearAllMocks();

    const handlerPromise = searchByQuery.handler({
      query: 'test',
      fileTypes: ['py'],
    });

    setImmediate(() => {
      mockProcess.emit('close', 1, null);
    });

    await handlerPromise;

    const spawnCall = vi.mocked(spawn).mock.calls[0];
    const args = spawnCall[1] as string[];
    // normalizeGlob: no dot means add *.
    expect(args.join(' ')).toContain('*.py');
  });
});

describe('formatSnippet Helper', () => {
  // Test indirectly through result snippets

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format match lines with > prefix', async () => {
    const handlerPromise = searchByQuery.handler({
      query: 'test',
      contextLines: 0,
    });

    setImmediate(() => {
      mockStdout.emit('data', 'file.ts:5:matched line\n');
      mockProcess.emit('close', 0, null);
    });

    const result = await handlerPromise;

    expect(result.results[0].snippet).toContain('>');
    expect(result.results[0].snippet).toContain('5');
    expect(result.results[0].snippet).toContain('matched line');
  });

  it('should format context lines with space prefix', async () => {
    const handlerPromise = searchByQuery.handler({
      query: 'test',
      contextLines: 1,
    });

    setImmediate(() => {
      mockStdout.emit('data', 'file.ts-4-context line\n');
      mockStdout.emit('data', 'file.ts:5:matched line\n');
      mockProcess.emit('close', 0, null);
    });

    const result = await handlerPromise;

    // Context lines should have space prefix, match lines should have >
    const snippet = result.results[0].snippet;
    const lines = snippet.split('\n');

    // First line should be context (starts with space, not >)
    expect(lines[0].startsWith(' ')).toBe(true);
    expect(lines[0]).toContain('4:');
    expect(lines[0]).toContain('context line');
    // Second line should be match (> prefix)
    expect(lines[1].startsWith('>')).toBe(true);
    expect(lines[1]).toContain('5:');
    expect(lines[1]).toContain('matched line');
  });
});

describe('Integration Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle search across multiple file types', async () => {
    const handlerPromise = searchByQuery.handler({
      query: 'import',
      fileTypes: ['.ts', '.js', '.json'],
      maxResults: 50,
      contextLines: 2,
    });

    setImmediate(() => {
      mockStdout.emit('data', 'src/index.ts:1:import foo from "bar";\n');
      mockStdout.emit('data', 'lib/util.js:5:import { helper } from "./helper";\n');
      mockProcess.emit('close', 0, null);
    });

    const result = await handlerPromise;

    expect(result.results).toHaveLength(2);
    expect(result.results[0].file).toContain('.ts');
    expect(result.results[1].file).toContain('.js');
  });

  it('should handle special characters in query', async () => {
    const queryWithSpecialChars = 'function\\s+\\w+';
    const handlerPromise = searchByQuery.handler({
      query: queryWithSpecialChars,
    });

    setImmediate(() => {
      mockProcess.emit('close', 1, null);
    });

    await handlerPromise;

    const spawnCall = vi.mocked(spawn).mock.calls[0];
    const args = spawnCall[1] as string[];
    // The query should be passed through to ripgrep
    expect(args.join('|||')).toContain(queryWithSpecialChars);
  });

  it('should handle chunked output', async () => {
    const handlerPromise = searchByQuery.handler({ query: 'test' });

    setImmediate(() => {
      // Simulate chunked output
      mockStdout.emit('data', 'src/fi');
      mockStdout.emit('data', 'le.ts:10:');
      mockStdout.emit('data', 'const test');
      mockStdout.emit('data', ' = true;\n');
      mockProcess.emit('close', 0, null);
    });

    const result = await handlerPromise;

    expect(result.results).toHaveLength(1);
    expect(result.results[0].file).toBe('src/file.ts');
    expect(result.results[0].snippet).toContain('const test = true');
  });
});
