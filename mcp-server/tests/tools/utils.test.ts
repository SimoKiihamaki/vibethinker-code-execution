/**
 * utils.ts Unit Tests
 *
 * Tests for error utilities and helper functions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ErrorCodes,
  createError,
  createToolSuccess,
  createToolFailure,
  withErrorHandling,
  formatMCPError,
  isToolError,
  isToolSuccess,
  escapeRegExp,
  isPathWithinRepo,
} from '../../src/tools/utils.js';

describe('Error Utilities', () => {
  describe('ErrorCodes', () => {
    it('should have all expected error codes', () => {
      expect(ErrorCodes.PATH_ACCESS_DENIED).toBe('PATH_ACCESS_DENIED');
      expect(ErrorCodes.PATH_NOT_FOUND).toBe('PATH_NOT_FOUND');
      expect(ErrorCodes.TOOL_NOT_FOUND).toBe('TOOL_NOT_FOUND');
      expect(ErrorCodes.TOOL_EXECUTION_ERROR).toBe('TOOL_EXECUTION_ERROR');
      expect(ErrorCodes.MLX_UNAVAILABLE).toBe('MLX_UNAVAILABLE');
      expect(ErrorCodes.INVALID_INPUT).toBe('INVALID_INPUT');
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });

    it('should have unique values', () => {
      const values = Object.values(ErrorCodes);
      const uniqueValues = new Set(values);
      expect(values.length).toBe(uniqueValues.size);
    });
  });

  describe('createError', () => {
    it('should create a structured error with required fields', () => {
      const error = createError(ErrorCodes.PATH_NOT_FOUND, 'File not found');

      expect(error.code).toBe('PATH_NOT_FOUND');
      expect(error.message).toBe('File not found');
      expect(error.timestamp).toBeDefined();
      expect(new Date(error.timestamp).getTime()).not.toBeNaN();
    });

    it('should include optional recovery hint', () => {
      const error = createError(ErrorCodes.PATH_NOT_FOUND, 'File not found', {
        recoveryHint: 'Check the file path',
      });

      expect(error.recoveryHint).toBe('Check the file path');
    });

    it('should include optional context', () => {
      const error = createError(ErrorCodes.PATH_NOT_FOUND, 'File not found', {
        context: { path: '/some/path', searchedIn: ['/dir1', '/dir2'] },
      });

      expect(error.context).toEqual({ path: '/some/path', searchedIn: ['/dir1', '/dir2'] });
    });
  });

  describe('createToolSuccess', () => {
    it('should create a successful result with data', () => {
      const result = createToolSuccess({ foo: 'bar' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ foo: 'bar' });
      expect(result.error).toBeUndefined();
    });

    it('should include metadata', () => {
      const result = createToolSuccess('data', {
        executionTime: 100,
        tokensUsed: 50,
        cacheHit: true,
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.executionTime).toBe(100);
      expect(result.metadata?.tokensUsed).toBe(50);
      expect(result.metadata?.cacheHit).toBe(true);
      expect(result.metadata?.timestamp).toBeDefined();
    });

    it('should use default values for missing metadata', () => {
      const result = createToolSuccess('data');

      expect(result.metadata?.executionTime).toBe(0);
      expect(result.metadata?.timestamp).toBeDefined();
    });
  });

  describe('createToolFailure', () => {
    it('should create a failed result with error', () => {
      const result = createToolFailure(ErrorCodes.TOOL_TIMEOUT, 'Operation timed out');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_TIMEOUT');
      expect(result.error?.message).toBe('Operation timed out');
      expect(result.data).toBeUndefined();
    });

    it('should include recovery hint in error', () => {
      const result = createToolFailure(ErrorCodes.TOOL_TIMEOUT, 'Operation timed out', {
        recoveryHint: 'Try with shorter input',
      });

      expect(result.error?.recoveryHint).toBe('Try with shorter input');
    });

    it('should include metadata', () => {
      const result = createToolFailure(ErrorCodes.INTERNAL_ERROR, 'Error', {
        metadata: { executionTime: 500 },
      });

      expect(result.metadata?.executionTime).toBe(500);
    });
  });

  describe('withErrorHandling', () => {
    it('should return success result for successful function', async () => {
      const result = await withErrorHandling(
        async () => ({ value: 42 }),
        { toolName: 'testTool' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ value: 42 });
    });

    it('should return failure result for throwing function', async () => {
      const result = await withErrorHandling(
        async () => {
          throw new Error('Something went wrong');
        },
        { toolName: 'testTool' }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Something went wrong');
    });

    it('should infer error code from error message', async () => {
      const accessDenied = await withErrorHandling(
        async () => {
          throw new Error('Access denied to resource');
        },
        { toolName: 'testTool' }
      );
      expect(accessDenied.error?.code).toBe('PATH_ACCESS_DENIED');

      const notFound = await withErrorHandling(
        async () => {
          throw new Error('ENOENT: file not found');
        },
        { toolName: 'testTool' }
      );
      expect(notFound.error?.code).toBe('PATH_NOT_FOUND');

      const timeout = await withErrorHandling(
        async () => {
          throw new Error('Request timeout');
        },
        { toolName: 'testTool' }
      );
      expect(timeout.error?.code).toBe('TOOL_TIMEOUT');
    });

    it('should track execution time', async () => {
      const startTime = Date.now();
      const result = await withErrorHandling(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'done';
        },
        { toolName: 'testTool', startTime }
      );

      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('formatMCPError', () => {
    it('should format error for MCP response', () => {
      const error = createError(ErrorCodes.TOOL_NOT_FOUND, 'Tool "foo" not found', {
        recoveryHint: 'Check the tool name',
      });

      const formatted = formatMCPError(error);

      expect(formatted.isError).toBe(true);
      expect(formatted.content).toHaveLength(1);
      expect(formatted.content[0].type).toBe('text');
      expect(formatted.content[0].text).toContain('Tool "foo" not found');
      expect(formatted.content[0].text).toContain('TOOL_NOT_FOUND');
      expect(formatted.content[0].text).toContain('Check the tool name');
    });

    it('should handle error without recovery hint', () => {
      const error = createError(ErrorCodes.INTERNAL_ERROR, 'Unknown error');

      const formatted = formatMCPError(error);

      expect(formatted.content[0].text).not.toContain('Hint:');
    });
  });

  describe('isToolError', () => {
    it('should return true for failed results', () => {
      const result = createToolFailure(ErrorCodes.INTERNAL_ERROR, 'Error');
      expect(isToolError(result)).toBe(true);
    });

    it('should return false for successful results', () => {
      const result = createToolSuccess('data');
      expect(isToolError(result)).toBe(false);
    });
  });

  describe('isToolSuccess', () => {
    it('should return true for successful results', () => {
      const result = createToolSuccess('data');
      expect(isToolSuccess(result)).toBe(true);
    });

    it('should return false for failed results', () => {
      const result = createToolFailure(ErrorCodes.INTERNAL_ERROR, 'Error');
      expect(isToolSuccess(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result = createToolSuccess({ value: 42 });

      if (isToolSuccess(result)) {
        // TypeScript should know result.data is defined here
        expect(result.data.value).toBe(42);
      }
    });
  });
});

describe('Path Utilities', () => {
  describe('isPathWithinRepo', () => {
    it('should return true for paths within repo', () => {
      expect(isPathWithinRepo('/repo/src/file.ts', '/repo')).toBe(true);
      expect(isPathWithinRepo('/repo/nested/deep/file.ts', '/repo')).toBe(true);
    });

    it('should return true when path equals repo root', () => {
      expect(isPathWithinRepo('/repo', '/repo')).toBe(true);
    });

    it('should return false for paths outside repo', () => {
      expect(isPathWithinRepo('/other/file.ts', '/repo')).toBe(false);
      expect(isPathWithinRepo('/repoadjacent/file.ts', '/repo')).toBe(false);
    });

    it('should handle trailing separators', () => {
      expect(isPathWithinRepo('/repo/src', '/repo/')).toBe(true);
    });
  });

  describe('escapeRegExp', () => {
    it('should escape special regex characters', () => {
      expect(escapeRegExp('foo.bar')).toBe('foo\\.bar');
      expect(escapeRegExp('foo*bar')).toBe('foo\\*bar');
      expect(escapeRegExp('foo[bar]')).toBe('foo\\[bar\\]');
      expect(escapeRegExp('foo(bar)')).toBe('foo\\(bar\\)');
      expect(escapeRegExp('foo?bar')).toBe('foo\\?bar');
      expect(escapeRegExp('foo+bar')).toBe('foo\\+bar');
      expect(escapeRegExp('foo^bar$')).toBe('foo\\^bar\\$');
      expect(escapeRegExp('foo{bar}')).toBe('foo\\{bar\\}');
      expect(escapeRegExp('foo|bar')).toBe('foo\\|bar');
      expect(escapeRegExp('foo\\bar')).toBe('foo\\\\bar');
    });

    it('should handle strings without special characters', () => {
      expect(escapeRegExp('foobar')).toBe('foobar');
      expect(escapeRegExp('foo_bar-baz')).toBe('foo_bar-baz');
    });

    it('should handle empty string', () => {
      expect(escapeRegExp('')).toBe('');
    });

    it('should produce valid regex pattern', () => {
      const pattern = 'file.*.txt';
      const escaped = escapeRegExp(pattern);
      const regex = new RegExp(escaped);

      expect(regex.test('file.*.txt')).toBe(true);
      expect(regex.test('file123.txt')).toBe(false);
    });
  });
});
