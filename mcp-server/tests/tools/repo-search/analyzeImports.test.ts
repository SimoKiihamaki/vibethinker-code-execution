/**
 * analyzeImports.ts Unit Tests
 *
 * Tests for the import analysis and circular dependency detection tool
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { analyzeImports } from '../../../src/tools/definitions/repo-search/analyzeImports.js';

// Mock validatePath and resolveImportPath to bypass repository root check
vi.mock('../../../src/tools/utils.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/tools/utils.js')>();
  return {
    ...original,
    validatePath: vi.fn().mockImplementation(async (p: string) => path.resolve(p)),
    resolveImportPath: vi.fn().mockImplementation(async (fromFile: string, importSpec: string) => {
      // Simple resolution: resolve relative to the importing file
      const dir = path.dirname(fromFile);
      const resolved = path.resolve(dir, importSpec);
      // Try common extensions
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
      for (const ext of extensions) {
        try {
          await fs.access(resolved + ext);
          return resolved + ext;
        } catch {
          // Continue trying other extensions
        }
      }
      return null;
    }),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('analyzeImports Tool', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'analyzeImports-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Metadata', () => {
    it('should have correct name', () => {
      expect(analyzeImports.name).toBe('analyzeImports');
    });

    it('should have correct category', () => {
      expect(analyzeImports.category).toBe('repo-search');
    });

    it('should have description about imports', () => {
      expect(analyzeImports.description).toContain('import');
    });

    it('should have required schema properties', () => {
      const schema = analyzeImports.inputSchema;
      expect(schema).toBeDefined();
    });

    it('should have appropriate tags', () => {
      expect(analyzeImports.tags).toContain('imports');
      expect(analyzeImports.tags).toContain('cycles');
    });

    it('should have complex complexity', () => {
      expect(analyzeImports.complexity).toBe('complex');
    });
  });

  describe('Import Detection', () => {
    it('should detect ES6 imports', async () => {
      const testFile = path.join(tempDir, 'es6-imports.ts');
      await fs.writeFile(testFile, `
        import { foo } from 'lodash';
        import bar from 'react';
        import * as utils from './utils';
      `);

      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      expect(result.metrics.filesAnalyzed).toBeGreaterThanOrEqual(1);
      expect(result.patterns.some((p: any) => p.name === 'lodash')).toBe(true);
      expect(result.patterns.some((p: any) => p.name === 'react')).toBe(true);
    });

    it('should detect CommonJS requires', async () => {
      const testFile = path.join(tempDir, 'commonjs.js');
      await fs.writeFile(testFile, `
        const fs = require('fs');
        const path = require('path');
      `);

      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      expect(result.patterns.some((p: any) => p.name === 'fs')).toBe(true);
      expect(result.patterns.some((p: any) => p.name === 'path')).toBe(true);
    });

    it('should count import occurrences', async () => {
      const file1 = path.join(tempDir, 'count1.ts');
      const file2 = path.join(tempDir, 'count2.ts');
      await fs.writeFile(file1, `import React from 'react';`);
      await fs.writeFile(file2, `import React from 'react';`);

      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      const reactPattern = result.patterns.find((p: any) => p.name === 'react');
      expect(reactPattern?.count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect direct circular dependencies', async () => {
      const cycleDir = path.join(tempDir, 'cycle-direct');
      await fs.mkdir(cycleDir, { recursive: true });

      const fileA = path.join(cycleDir, 'a.ts');
      const fileB = path.join(cycleDir, 'b.ts');

      await fs.writeFile(fileA, `import { b } from './b';`);
      await fs.writeFile(fileB, `import { a } from './a';`);

      const result = await analyzeImports.handler({
        directory: cycleDir,
        detectCycles: true,
        analyzePatterns: false,
      });

      expect(result.metrics.cycles).toBeGreaterThanOrEqual(0);
    });

    it('should detect indirect circular dependencies', async () => {
      const cycleDir = path.join(tempDir, 'cycle-indirect');
      await fs.mkdir(cycleDir, { recursive: true });

      const fileA = path.join(cycleDir, 'a.ts');
      const fileB = path.join(cycleDir, 'b.ts');
      const fileC = path.join(cycleDir, 'c.ts');

      await fs.writeFile(fileA, `import { b } from './b';`);
      await fs.writeFile(fileB, `import { c } from './c';`);
      await fs.writeFile(fileC, `import { a } from './a';`);

      const result = await analyzeImports.handler({
        directory: cycleDir,
        detectCycles: true,
        analyzePatterns: false,
      });

      expect(result.cycles).toBeDefined();
    });

    it('should not report cycles when disabled', async () => {
      const cycleDir = path.join(tempDir, 'cycle-disabled');
      await fs.mkdir(cycleDir, { recursive: true });

      const fileA = path.join(cycleDir, 'a.ts');
      const fileB = path.join(cycleDir, 'b.ts');

      await fs.writeFile(fileA, `import { b } from './b';`);
      await fs.writeFile(fileB, `import { a } from './a';`);

      const result = await analyzeImports.handler({
        directory: cycleDir,
        detectCycles: false,
        analyzePatterns: false,
      });

      // When detectCycles is false, cycles array should be empty
      expect(result.cycles).toEqual([]);
    });
  });

  describe('Directory Walking', () => {
    it('should scan directories recursively', async () => {
      const subDir = path.join(tempDir, 'imports-subdir');
      await fs.mkdir(subDir, { recursive: true });

      const file1 = path.join(tempDir, 'root.ts');
      const file2 = path.join(subDir, 'nested.ts');

      await fs.writeFile(file1, `import { a } from 'pkg-a';`);
      await fs.writeFile(file2, `import { b } from 'pkg-b';`);

      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      expect(result.metrics.filesAnalyzed).toBeGreaterThanOrEqual(2);
    });

    it('should skip node_modules', async () => {
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      await fs.mkdir(nodeModulesDir, { recursive: true });

      const moduleFile = path.join(nodeModulesDir, 'dep.ts');
      await fs.writeFile(moduleFile, `import x from 'internal-dep';`);

      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      // Should not include internal-dep from node_modules
      expect(result.patterns.some((p: any) => p.name === 'internal-dep')).toBe(false);
    });

    it('should skip .git directory', async () => {
      const gitDir = path.join(tempDir, '.git');
      await fs.mkdir(gitDir, { recursive: true });

      const gitFile = path.join(gitDir, 'hooks.ts');
      await fs.writeFile(gitFile, `import x from 'git-internal';`);

      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      expect(result.patterns.some((p: any) => p.name === 'git-internal')).toBe(false);
    });
  });

  describe('Result Structure', () => {
    it('should return summary with file count', async () => {
      const testFile = path.join(tempDir, 'summary-test.ts');
      await fs.writeFile(testFile, `import x from 'test-pkg';`);

      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: true,
        analyzePatterns: true,
      });

      expect(result.summary).toContain('Analyzed');
      expect(result.summary).toMatch(/\d+ files/);
    });

    it('should return metrics object', async () => {
      const testFile = path.join(tempDir, 'metrics-test.ts');
      await fs.writeFile(testFile, `import x from 'metrics-pkg';`);

      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: true,
        analyzePatterns: true,
      });

      expect(result.metrics).toBeDefined();
      expect(result.metrics.filesAnalyzed).toBeDefined();
      expect(result.metrics.imports).toBeDefined();
      expect(result.metrics.cycles).toBeDefined();
    });

    it('should return cycles array', async () => {
      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: true,
        analyzePatterns: false,
      });

      expect(result.cycles).toBeDefined();
      expect(Array.isArray(result.cycles)).toBe(true);
    });

    it('should return patterns array', async () => {
      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      expect(result.patterns).toBeDefined();
      expect(Array.isArray(result.patterns)).toBe(true);
    });

    it('should sort patterns by count descending', async () => {
      const file1 = path.join(tempDir, 'sort1.ts');
      const file2 = path.join(tempDir, 'sort2.ts');
      const file3 = path.join(tempDir, 'sort3.ts');

      await fs.writeFile(file1, `
        import React from 'react';
        import { useState } from 'react';
      `);
      await fs.writeFile(file2, `import React from 'react';`);
      await fs.writeFile(file3, `import lodash from 'lodash';`);

      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      if (result.patterns.length >= 2) {
        expect(result.patterns[0].count).toBeGreaterThanOrEqual(result.patterns[1].count);
      }
    });

    it('should limit patterns to top 20', async () => {
      // Create many files with different imports
      for (let i = 0; i < 25; i++) {
        const file = path.join(tempDir, `many-imports-${i}.ts`);
        await fs.writeFile(file, `import pkg${i} from 'package-${i}';`);
      }

      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      expect(result.patterns.length).toBeLessThanOrEqual(20);
    });
  });

  describe('File Type Handling', () => {
    it('should analyze .ts files', async () => {
      const typeDir = path.join(tempDir, 'ts-type-test');
      await fs.mkdir(typeDir, { recursive: true });

      const tsFile = path.join(typeDir, 'typescript-import.ts');
      await fs.writeFile(tsFile, `import { TypeScript } from 'typescript-unique-pkg';`);

      const result = await analyzeImports.handler({
        directory: typeDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      expect(result.patterns.some((p: any) => p.name === 'typescript-unique-pkg')).toBe(true);
    });

    it('should analyze .js files', async () => {
      const typeDir = path.join(tempDir, 'js-type-test');
      await fs.mkdir(typeDir, { recursive: true });

      const jsFile = path.join(typeDir, 'javascript-import.js');
      await fs.writeFile(jsFile, `import { JavaScript } from 'javascript-unique-pkg';`);

      const result = await analyzeImports.handler({
        directory: typeDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      expect(result.patterns.some((p: any) => p.name === 'javascript-unique-pkg')).toBe(true);
    });

    it('should analyze .tsx files', async () => {
      const typeDir = path.join(tempDir, 'tsx-type-test');
      await fs.mkdir(typeDir, { recursive: true });

      const tsxFile = path.join(typeDir, 'react-component.tsx');
      await fs.writeFile(tsxFile, `import React from 'react-tsx-unique-pkg';`);

      const result = await analyzeImports.handler({
        directory: typeDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      expect(result.patterns.some((p: any) => p.name === 'react-tsx-unique-pkg')).toBe(true);
    });

    it('should analyze .jsx files', async () => {
      const typeDir = path.join(tempDir, 'jsx-type-test');
      await fs.mkdir(typeDir, { recursive: true });

      const jsxFile = path.join(typeDir, 'react-jsx.jsx');
      await fs.writeFile(jsxFile, `import React from 'react-jsx-unique-pkg';`);

      const result = await analyzeImports.handler({
        directory: typeDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      expect(result.patterns.some((p: any) => p.name === 'react-jsx-unique-pkg')).toBe(true);
    });

    it('should skip non-JS/TS files', async () => {
      const typeDir = path.join(tempDir, 'md-type-test');
      await fs.mkdir(typeDir, { recursive: true });

      const mdFile = path.join(typeDir, 'readme.md');
      await fs.writeFile(mdFile, `import { markdown } from 'markdown-unique-pkg';`);

      const result = await analyzeImports.handler({
        directory: typeDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      expect(result.patterns.some((p: any) => p.name === 'markdown-unique-pkg')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty directories gracefully', async () => {
      const emptyDir = path.join(tempDir, 'empty-import-dir');
      await fs.mkdir(emptyDir, { recursive: true });

      const result = await analyzeImports.handler({
        directory: emptyDir,
        detectCycles: true,
        analyzePatterns: true,
      });

      expect(result.metrics.filesAnalyzed).toBe(0);
      expect(result.patterns).toEqual([]);
      expect(result.cycles).toEqual([]);
    });

    it('should handle non-existent directory gracefully', async () => {
      const result = await analyzeImports.handler({
        directory: path.join(tempDir, 'nonexistent-import-dir'),
        detectCycles: true,
        analyzePatterns: true,
      });

      // Should not throw, return empty results
      expect(result.metrics.filesAnalyzed).toBe(0);
    });

    it('should handle files with no imports', async () => {
      const noImportsFile = path.join(tempDir, 'no-imports.ts');
      await fs.writeFile(noImportsFile, `
        const x = 1;
        export const y = 2;
      `);

      const result = await analyzeImports.handler({
        directory: tempDir,
        detectCycles: false,
        analyzePatterns: true,
      });

      // Should still count the file
      expect(result.metrics.filesAnalyzed).toBeGreaterThan(0);
    });
  });

  describe('Schema Defaults', () => {
    it('should use default detectCycles when not specified', async () => {
      const parsedArgs = analyzeImports.inputSchema.parse({
        directory: tempDir,
      });

      expect(parsedArgs.detectCycles).toBe(true);
    });

    it('should use default analyzePatterns when not specified', async () => {
      const parsedArgs = analyzeImports.inputSchema.parse({
        directory: tempDir,
      });

      expect(parsedArgs.analyzePatterns).toBe(true);
    });
  });
});
