/**
 * analyzeFile Tool Unit Tests
 *
 * Tests for the code analysis tool that performs deep file analysis
 * including complexity metrics, pattern detection, and issue finding.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock validatePath to bypass repository root check for testing
vi.mock('../../../src/tools/utils.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/tools/utils.js')>();
  return {
    ...original,
    // Allow any path in tests
    validatePath: vi.fn().mockImplementation(async (p: string) => {
      const resolved = path.resolve(p);
      return resolved;
    }),
  };
});

// Import after mocking
import { analyzeFile } from '../../../src/tools/definitions/code-analysis/analyzeFile.js';

// Test fixtures directory
let tempDir: string;

// Sample test files
const sampleTypeScriptCode = `
import { foo } from './utils';

// TODO: Add error handling
function calculateSum(a: number, b: number): number {
  console.log('calculating...');
  if (a > 0) {
    for (let i = 0; i < b; i++) {
      a += i;
    }
  }
  return a + b;
}

// FIXME: This is deprecated
var legacyVar = 42;

const arrowFunc = (x: number) => {
  while (x > 0) {
    x--;
  }
  return x;
};

export class Calculator {
  add(a: number, b: number) {
    try {
      return a + b;
    } catch (e) {
      console.log('error');
      throw e;
    }
  }
}
`;

const simpleCode = `
function hello() {
  return 'world';
}
`;

const complexCode = `
function process(data) {
  if (data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      if (data[i].active) {
        switch (data[i].type) {
          case 'a':
            while (data[i].count > 0) {
              data[i].count--;
            }
            break;
          case 'b':
            try {
              process(data[i].nested);
            } catch (e) {
              console.log(e);
            }
            break;
        }
      }
    }
  }
  return data;
}
`;

describe('analyzeFile Tool', () => {
  beforeAll(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'analyzeFile-test-'));

    // Write test files
    await fs.writeFile(path.join(tempDir, 'sample.ts'), sampleTypeScriptCode);
    await fs.writeFile(path.join(tempDir, 'simple.js'), simpleCode);
    await fs.writeFile(path.join(tempDir, 'complex.js'), complexCode);
  });

  afterAll(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Tool Definition', () => {
    it('should have correct metadata', () => {
      expect(analyzeFile.name).toBe('analyzeFile');
      expect(analyzeFile.category).toBe('code-analysis');
      expect(analyzeFile.complexity).toBe('moderate');
      expect(analyzeFile.tags).toContain('analysis');
      expect(analyzeFile.tags).toContain('complexity');
    });

    it('should have valid input schema', () => {
      expect(analyzeFile.inputSchema).toBeDefined();
      const shape = analyzeFile.inputSchema.shape;
      expect(shape.filePath).toBeDefined();
      expect(shape.analysisType).toBeDefined();
      expect(shape.includeSuggestions).toBeDefined();
    });

    it('should declare correct dependencies', () => {
      expect(analyzeFile.npmDependencies).toContain('@ast-grep/napi');
      expect(analyzeFile.internalDependencies).toContain('../../utils.js:validatePath');
    });
  });

  describe('Full Analysis', () => {
    it('should analyze a TypeScript file with full analysis type', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'sample.ts'),
        analysisType: 'full',
        includeSuggestions: true,
      });

      expect(result.summary).toBe('File analyzed');
      expect(result.metrics).toBeDefined();
      expect(result.metrics.lines).toBeGreaterThan(0);
      expect(result.metrics.complexity).toBeGreaterThan(0);
      expect(result.findings).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
    });

    it('should detect console.log calls', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'sample.ts'),
        analysisType: 'full',
        includeSuggestions: true,
      });

      const consoleFindings = result.findings.filter(
        (f: { type: string }) => f.type === 'code_smell' && f.details.includes('console.log')
      );
      expect(consoleFindings.length).toBeGreaterThan(0);
    });

    it('should detect TODO/FIXME comments', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'sample.ts'),
        analysisType: 'full',
        includeSuggestions: true,
      });

      const todoFindings = result.findings.filter(
        (f: { type: string }) => f.type === 'todo_comment'
      );
      expect(todoFindings.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect legacy var usage', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'sample.ts'),
        analysisType: 'issues',
        includeSuggestions: true,
      });

      const varFindings = result.findings.filter(
        (f: { type: string }) => f.type === 'legacy_syntax'
      );
      expect(varFindings.length).toBeGreaterThan(0);
    });
  });

  describe('Complexity Analysis', () => {
    it('should calculate cyclomatic complexity', async () => {
      const simpleResult = await analyzeFile.handler({
        filePath: path.join(tempDir, 'simple.js'),
        analysisType: 'complexity',
        includeSuggestions: false,
      });

      const complexResult = await analyzeFile.handler({
        filePath: path.join(tempDir, 'complex.js'),
        analysisType: 'complexity',
        includeSuggestions: false,
      });

      // Complex code should have higher complexity
      expect(complexResult.metrics.complexity).toBeGreaterThan(
        simpleResult.metrics.complexity
      );
    });

    it('should count functions correctly', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'sample.ts'),
        analysisType: 'complexity',
        includeSuggestions: false,
      });

      // Should find: calculateSum, arrowFunc, Calculator.add
      expect(result.metrics.functions).toBeGreaterThanOrEqual(2);
    });

    it('should count lines correctly', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'simple.js'),
        analysisType: 'complexity',
        includeSuggestions: false,
      });

      expect(result.metrics.lines).toBe(simpleCode.split('\n').length);
    });
  });

  describe('Pattern Analysis', () => {
    it('should analyze patterns only when type is patterns', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'sample.ts'),
        analysisType: 'patterns',
        includeSuggestions: false,
      });

      expect(result.findings).toBeDefined();
      // Should find code smells and todo comments, but not necessarily issues like var
      const todoFindings = result.findings.filter(
        (f: { type: string }) => f.type === 'todo_comment'
      );
      expect(todoFindings.length).toBeGreaterThan(0);
    });
  });

  describe('Suggestions', () => {
    it('should include suggestions when includeSuggestions is true', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'sample.ts'),
        analysisType: 'full',
        includeSuggestions: true,
      });

      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it('should not include suggestions when includeSuggestions is false', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'sample.ts'),
        analysisType: 'full',
        includeSuggestions: false,
      });

      expect(result.actions).toBeDefined();
      expect(result.actions.length).toBe(0);
    });

    it('should deduplicate suggestions', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'sample.ts'),
        analysisType: 'full',
        includeSuggestions: true,
      });

      // Check for no duplicates
      const uniqueActions = [...new Set(result.actions)];
      expect(result.actions.length).toBe(uniqueActions.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent files gracefully', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'nonexistent.ts'),
        analysisType: 'full',
        includeSuggestions: true,
      });

      expect(result.summary).toBe('File not found');
      expect(result.metrics.complexity).toBe(0);
      expect(result.metrics.lines).toBe(0);
      expect(result.metrics.functions).toBe(0);
    });

    it('should handle empty files', async () => {
      await fs.writeFile(path.join(tempDir, 'empty.ts'), '');

      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'empty.ts'),
        analysisType: 'full',
        includeSuggestions: true,
      });

      expect(result.summary).toBe('File analyzed');
      expect(result.metrics.lines).toBe(1); // Empty file has 1 line
      expect(result.metrics.complexity).toBeGreaterThanOrEqual(1);
    });

    it('should use regex fallback when ast-grep fails', async () => {
      // Create a file with unsupported extension
      await fs.writeFile(path.join(tempDir, 'test.xyz'), `
        function test() {
          if (true) {
            return 1;
          }
        }
      `);

      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'test.xyz'),
        analysisType: 'complexity',
        includeSuggestions: false,
      });

      // Should still calculate basic metrics using regex fallback
      expect(result.metrics.complexity).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Input Validation', () => {
    it('should handle default analysis type', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'simple.js'),
        // analysisType not provided - should default to 'full'
        includeSuggestions: true,
      });

      expect(result.summary).toBe('File analyzed');
    });

    it('should handle default includeSuggestions', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'sample.ts'),
        analysisType: 'full',
        // includeSuggestions not provided - should default to true
      });

      // With default true, should have actions if findings exist
      if (result.findings.length > 0) {
        expect(result.actions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('File Extensions', () => {
    it('should handle .ts files', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'sample.ts'),
        analysisType: 'full',
        includeSuggestions: false,
      });

      expect(result.summary).toBe('File analyzed');
    });

    it('should handle .tsx files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'component.tsx'),
        `
        import React from 'react';

        const MyComponent: React.FC = () => {
          console.log('render');
          return <div>Hello</div>;
        };

        export default MyComponent;
      `
      );

      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'component.tsx'),
        analysisType: 'full',
        includeSuggestions: true,
      });

      expect(result.summary).toBe('File analyzed');
    });

    it('should handle .js files', async () => {
      const result = await analyzeFile.handler({
        filePath: path.join(tempDir, 'simple.js'),
        analysisType: 'full',
        includeSuggestions: false,
      });

      expect(result.summary).toBe('File analyzed');
    });
  });
});
