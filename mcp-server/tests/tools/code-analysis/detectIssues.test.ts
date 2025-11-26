/**
 * detectIssues.ts Unit Tests
 *
 * Tests for the code issue detection tool
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { detectIssues } from '../../../src/tools/definitions/code-analysis/detectIssues.js';

// Mock validatePath to bypass repository root check
vi.mock('../../../src/tools/utils.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/tools/utils.js')>();
  return {
    ...original,
    validatePath: vi.fn().mockImplementation(async (p: string) => path.resolve(p)),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('detectIssues Tool', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'detectIssues-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Metadata', () => {
    it('should have correct name', () => {
      expect(detectIssues.name).toBe('detectIssues');
    });

    it('should have correct category', () => {
      expect(detectIssues.category).toBe('code-analysis');
    });

    it('should have description', () => {
      expect(detectIssues.description).toContain('issues');
    });

    it('should have required schema properties', () => {
      const schema = detectIssues.inputSchema;
      expect(schema).toBeDefined();
    });

    it('should list ast-grep as npm dependency', () => {
      expect(detectIssues.npmDependencies).toContain('@ast-grep/napi');
    });

    it('should have appropriate tags', () => {
      expect(detectIssues.tags).toContain('issues');
      expect(detectIssues.tags).toContain('bugs');
    });

    it('should have complex complexity', () => {
      expect(detectIssues.complexity).toBe('complex');
    });
  });

  describe('Code Smell Detection', () => {
    it('should detect TODO comments', async () => {
      const testFile = path.join(tempDir, 'todo-test.ts');
      await fs.writeFile(testFile, `
        // TODO: Fix this later
        function test() {
          return true;
        }
      `);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((i: any) => i.message.includes('TODO'))).toBe(true);
    });

    it('should detect FIXME comments', async () => {
      const testFile = path.join(tempDir, 'fixme-test.ts');
      await fs.writeFile(testFile, `
        // FIXME: This is broken
        const broken = null;
      `);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      expect(result.issues.some((i: any) => i.message.includes('TODO') || i.message.includes('FIXME'))).toBe(true);
    });

    it('should detect var usage', async () => {
      const testFile = path.join(tempDir, 'var-test.ts');
      await fs.writeFile(testFile, `
        var oldStyle = 'bad';
        let modern = 'good';
      `);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      expect(result.issues.some((i: any) => i.message.includes('var'))).toBe(true);
    });

    it('should detect console.log', async () => {
      const testFile = path.join(tempDir, 'console-test.ts');
      await fs.writeFile(testFile, `
        function debug() {
          console.log('debugging');
        }
      `);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      expect(result.issues.some((i: any) => i.message.includes('console.log'))).toBe(true);
    });
  });

  describe('Bug Detection', () => {
    it('should detect loose equality', async () => {
      const testFile = path.join(tempDir, 'equality-test.ts');
      await fs.writeFile(testFile, `
        if (a == b) {
          doSomething();
        }
      `);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['bugs'],
        confidence: 'medium',
      });

      expect(result.issues.some((i: any) => i.message.includes('equality') || i.message.includes('==='))).toBe(true);
    });

    it('should detect empty catch blocks', async () => {
      const testFile = path.join(tempDir, 'catch-test.ts');
      await fs.writeFile(testFile, `
        try {
          riskyOperation();
        } catch (e) {
          // empty catch - bad practice
        }
      `);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['bugs'],
        confidence: 'medium',
      });

      expect(result.issues.some((i: any) => i.message.toLowerCase().includes('catch'))).toBe(true);
    });
  });

  describe('Security Detection', () => {
    it('should detect eval usage', async () => {
      const testFile = path.join(tempDir, 'eval-test.ts');
      await fs.writeFile(testFile, `
        const dangerous = eval('1 + 1');
      `);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['security'],
        confidence: 'medium',
      });

      expect(result.issues.some((i: any) => i.message.includes('eval'))).toBe(true);
      expect(result.issues.some((i: any) => i.severity === 'high')).toBe(true);
    });

    it('should detect dangerouslySetInnerHTML', async () => {
      const testFile = path.join(tempDir, 'innerhtml-test.tsx');
      await fs.writeFile(testFile, `
        function Component() {
          return <div dangerouslySetInnerHTML={{ __html: content }} />;
        }
      `);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['security'],
        confidence: 'medium',
      });

      expect(result.issues.some((i: any) => i.message.includes('dangerouslySetInnerHTML'))).toBe(true);
    });
  });

  describe('Performance Detection', () => {
    it('should detect setInterval', async () => {
      const testFile = path.join(tempDir, 'interval-test.ts');
      await fs.writeFile(testFile, `
        setInterval(() => {
          console.log('tick');
        }, 1000);
      `);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['performance'],
        confidence: 'medium',
      });

      expect(result.issues.some((i: any) => i.message.includes('setInterval'))).toBe(true);
    });
  });

  describe('Directory Scanning', () => {
    it('should scan directories recursively', async () => {
      const subDir = path.join(tempDir, 'subdir');
      await fs.mkdir(subDir, { recursive: true });

      const file1 = path.join(tempDir, 'file1.ts');
      const file2 = path.join(subDir, 'file2.ts');

      await fs.writeFile(file1, 'var x = 1;');
      await fs.writeFile(file2, 'var y = 2;');

      const result = await detectIssues.handler({
        target: tempDir,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      // Should find var issues in both files
      const varIssues = result.issues.filter((i: any) => i.message.includes('var'));
      expect(varIssues.length).toBeGreaterThanOrEqual(2);
    });

    it('should skip node_modules directory', async () => {
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      await fs.mkdir(nodeModulesDir, { recursive: true });

      const moduleFile = path.join(nodeModulesDir, 'package.ts');
      await fs.writeFile(moduleFile, 'var badCode = true;');

      const testFile = path.join(tempDir, 'good.ts');
      await fs.writeFile(testFile, 'const goodCode = true;');

      const result = await detectIssues.handler({
        target: tempDir,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      // Should not include issues from node_modules
      const nodeModuleIssues = result.issues.filter((i: any) =>
        i.file.includes('node_modules')
      );
      expect(nodeModuleIssues.length).toBe(0);
    });

    it('should skip hidden directories', async () => {
      const hiddenDir = path.join(tempDir, '.hidden');
      await fs.mkdir(hiddenDir, { recursive: true });

      const hiddenFile = path.join(hiddenDir, 'secret.ts');
      await fs.writeFile(hiddenFile, 'var hidden = true;');

      const result = await detectIssues.handler({
        target: tempDir,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      // Should not include issues from hidden directories
      const hiddenIssues = result.issues.filter((i: any) =>
        i.file.includes('.hidden')
      );
      expect(hiddenIssues.length).toBe(0);
    });
  });

  describe('Issue Filtering', () => {
    it('should filter by issue type', async () => {
      const testFile = path.join(tempDir, 'mixed-issues.ts');
      await fs.writeFile(testFile, `
        var x = 1; // code smell
        eval('bad'); // security
        if (a == b) {} // bug
      `);

      // Only request security issues
      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['security'],
        confidence: 'medium',
      });

      // Should only have security issues
      expect(result.issues.every((i: any) => i.type === 'security')).toBe(true);
      expect(result.issues.some((i: any) => i.message.includes('eval'))).toBe(true);
    });

    it('should handle multiple issue types', async () => {
      const testFile = path.join(tempDir, 'multi-type.ts');
      await fs.writeFile(testFile, `
        var oldVar = 1;
        eval('dangerous');
      `);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['code-smells', 'security'],
        confidence: 'medium',
      });

      const types = new Set(result.issues.map((i: any) => i.type));
      expect(types.has('code-smells')).toBe(true);
      expect(types.has('security')).toBe(true);
    });

    it('should use default issue types when not specified', async () => {
      const testFile = path.join(tempDir, 'default-types.ts');
      await fs.writeFile(testFile, `
        var x = 1;
        if (a == b) {}
      `);

      const result = await detectIssues.handler({
        target: testFile,
        confidence: 'medium',
      });

      // Default is ['bugs', 'code-smells']
      expect(result.issueTypes).toContain('bugs');
      expect(result.issueTypes).toContain('code-smells');
    });
  });

  describe('Result Structure', () => {
    it('should return issues with correct structure', async () => {
      const testFile = path.join(tempDir, 'structure-test.ts');
      await fs.writeFile(testFile, 'var x = 1;');

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['code-smells'],
        confidence: 'high',
      });

      expect(result.issues).toBeDefined();
      expect(result.target).toBeDefined();
      expect(result.issueTypes).toBeDefined();
      expect(result.confidence).toBe('high');

      if (result.issues.length > 0) {
        const issue = result.issues[0];
        expect(issue.type).toBeDefined();
        expect(issue.message).toBeDefined();
        expect(issue.file).toBeDefined();
        expect(issue.severity).toBeDefined();
        expect(issue.confidence).toBe('high');
      }
    });

    it('should include line numbers for issues', async () => {
      const testFile = path.join(tempDir, 'line-number-test.ts');
      await fs.writeFile(testFile, `line1
line2
var badLine = 3;
line4`);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      const varIssue = result.issues.find((i: any) => i.message.includes('var'));
      expect(varIssue).toBeDefined();
      expect(varIssue.line).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent files gracefully', async () => {
      const result = await detectIssues.handler({
        target: path.join(tempDir, 'nonexistent.ts'),
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      // Should return empty issues, not throw
      expect(result.issues).toEqual([]);
    });

    it('should handle empty files', async () => {
      const testFile = path.join(tempDir, 'empty.ts');
      await fs.writeFile(testFile, '');

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      expect(result.issues).toEqual([]);
    });

    it('should handle files with only comments', async () => {
      const testFile = path.join(tempDir, 'comments-only.ts');
      await fs.writeFile(testFile, `
        // This is a comment
        /* Multi-line
           comment */
      `);

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['bugs'],
        confidence: 'medium',
      });

      // Should not crash, may or may not find issues
      expect(result.issues).toBeDefined();
    });
  });

  describe('Confidence Levels', () => {
    it('should pass through low confidence', async () => {
      const testFile = path.join(tempDir, 'confidence-low.ts');
      await fs.writeFile(testFile, 'var x = 1;');

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['code-smells'],
        confidence: 'low',
      });

      expect(result.confidence).toBe('low');
      if (result.issues.length > 0) {
        expect(result.issues[0].confidence).toBe('low');
      }
    });

    it('should pass through high confidence', async () => {
      const testFile = path.join(tempDir, 'confidence-high.ts');
      await fs.writeFile(testFile, 'var x = 1;');

      const result = await detectIssues.handler({
        target: testFile,
        issueTypes: ['code-smells'],
        confidence: 'high',
      });

      expect(result.confidence).toBe('high');
      if (result.issues.length > 0) {
        expect(result.issues[0].confidence).toBe('high');
      }
    });
  });

  describe('File Type Filtering', () => {
    it('should only analyze JavaScript/TypeScript files', async () => {
      const jsFile = path.join(tempDir, 'test.js');
      const tsFile = path.join(tempDir, 'test.ts');
      const mdFile = path.join(tempDir, 'test.md');

      await fs.writeFile(jsFile, 'var jsVar = 1;');
      await fs.writeFile(tsFile, 'var tsVar = 1;');
      await fs.writeFile(mdFile, 'var mdVar = 1;');

      const result = await detectIssues.handler({
        target: tempDir,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      // Should find issues in .js and .ts but not .md
      const files = new Set(result.issues.map((i: any) => path.extname(i.file)));
      expect(files.has('.js') || files.has('.ts')).toBe(true);
      expect(files.has('.md')).toBe(false);
    });

    it('should analyze .tsx files', async () => {
      const tsxFile = path.join(tempDir, 'component.tsx');
      await fs.writeFile(tsxFile, 'var component = () => <div />;');

      const result = await detectIssues.handler({
        target: tsxFile,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      expect(result.issues.some((i: any) => i.file.endsWith('.tsx'))).toBe(true);
    });

    it('should analyze .jsx files', async () => {
      const jsxFile = path.join(tempDir, 'component.jsx');
      await fs.writeFile(jsxFile, 'var component = () => <div />;');

      const result = await detectIssues.handler({
        target: jsxFile,
        issueTypes: ['code-smells'],
        confidence: 'medium',
      });

      expect(result.issues.some((i: any) => i.file.endsWith('.jsx'))).toBe(true);
    });
  });
});
