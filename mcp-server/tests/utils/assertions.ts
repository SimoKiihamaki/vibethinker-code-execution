/**
 * Custom Test Assertions
 *
 * Provides domain-specific assertions for testing VibeThinker components
 */
import { expect } from 'vitest';
import type { ToolResult } from '../../src/tools/types.js';
import type { HookExpectedOutput } from '../fixtures/hook-context.js';

/**
 * Assert that a tool result is successful
 */
export function expectToolSuccess<T>(
  result: ToolResult<T>,
  message?: string
): asserts result is ToolResult<T> & { success: true; data: T } {
  expect(result.success, message || 'Expected tool to succeed').toBe(true);
  expect(result.data, message || 'Expected tool to have data').toBeDefined();
  expect(result.error, message || 'Expected no error').toBeUndefined();
}

/**
 * Assert that a tool result is a failure
 */
export function expectToolFailure(
  result: ToolResult<unknown>,
  expectedCode?: string,
  message?: string
): asserts result is ToolResult<unknown> & { success: false } {
  expect(result.success, message || 'Expected tool to fail').toBe(false);

  if (expectedCode) {
    expect(result.error?.code, message || `Expected error code ${expectedCode}`).toBe(
      expectedCode
    );
  }
}

/**
 * Assert that a tool result has specific metadata
 */
export function expectToolMetadata(
  result: ToolResult<unknown>,
  checks: {
    hasExecutionTime?: boolean;
    hasCacheHit?: boolean;
    hasTokensUsed?: boolean;
    maxExecutionTime?: number;
  }
) {
  expect(result.metadata).toBeDefined();

  if (checks.hasExecutionTime) {
    expect(typeof result.metadata?.executionTime).toBe('number');
    expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
  }

  if (checks.hasCacheHit !== undefined) {
    expect(result.metadata?.cacheHit).toBe(checks.hasCacheHit);
  }

  if (checks.hasTokensUsed) {
    expect(typeof result.metadata?.tokensUsed).toBe('number');
  }

  if (checks.maxExecutionTime !== undefined) {
    expect(result.metadata?.executionTime).toBeLessThanOrEqual(checks.maxExecutionTime);
  }
}

/**
 * Assert that a hook output follows the JSON decision protocol
 */
export function expectValidHookOutput(output: unknown): asserts output is HookExpectedOutput {
  expect(output).toBeDefined();
  expect(typeof output).toBe('object');

  const hookOutput = output as Record<string, unknown>;

  expect(['continue', 'block']).toContain(hookOutput.decision);
  expect(typeof hookOutput.reason).toBe('string');
  expect(hookOutput.reason).not.toBe('');
}

/**
 * Assert that a hook output is a continue decision
 */
export function expectHookContinue(
  output: HookExpectedOutput,
  message?: string
): void {
  expect(output.decision, message || 'Expected hook to continue').toBe('continue');
}

/**
 * Assert that a hook output is a block decision
 */
export function expectHookBlock(
  output: HookExpectedOutput,
  expectedReason?: string | RegExp,
  message?: string
): void {
  expect(output.decision, message || 'Expected hook to block').toBe('block');

  if (expectedReason) {
    if (typeof expectedReason === 'string') {
      expect(output.reason).toContain(expectedReason);
    } else {
      expect(output.reason).toMatch(expectedReason);
    }
  }
}

/**
 * Assert that an error is a VibeThinkerError with specific code
 */
export function expectVibeThinkerError(
  error: unknown,
  expectedCode: string,
  message?: string
): void {
  expect(error).toBeDefined();
  expect(error).toBeInstanceOf(Error);

  const err = error as Error & { code?: string };
  expect(err.code, message || `Expected error code ${expectedCode}`).toBe(expectedCode);
}

/**
 * Assert that a value is within a range
 */
export function expectInRange(
  value: number,
  min: number,
  max: number,
  message?: string
): void {
  expect(value, message || `Expected ${value} to be between ${min} and ${max}`).toBeGreaterThanOrEqual(min);
  expect(value, message || `Expected ${value} to be between ${min} and ${max}`).toBeLessThanOrEqual(max);
}

/**
 * Assert that execution completes within a time limit
 */
export async function expectCompletesWithin<T>(
  fn: () => Promise<T>,
  maxMs: number,
  message?: string
): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;

  expect(
    elapsed,
    message || `Expected to complete within ${maxMs}ms but took ${elapsed}ms`
  ).toBeLessThanOrEqual(maxMs);

  return result;
}

/**
 * Assert that an async function throws
 */
export async function expectAsyncThrows(
  fn: () => Promise<unknown>,
  errorMatcher?: string | RegExp | { code?: string; message?: string | RegExp }
): Promise<void> {
  let threw = false;
  let caughtError: unknown;

  try {
    await fn();
  } catch (error) {
    threw = true;
    caughtError = error;
  }

  expect(threw, 'Expected function to throw').toBe(true);

  if (errorMatcher) {
    if (typeof errorMatcher === 'string') {
      expect((caughtError as Error).message).toContain(errorMatcher);
    } else if (errorMatcher instanceof RegExp) {
      expect((caughtError as Error).message).toMatch(errorMatcher);
    } else {
      if (errorMatcher.code) {
        expect((caughtError as { code?: string }).code).toBe(errorMatcher.code);
      }
      if (errorMatcher.message) {
        if (typeof errorMatcher.message === 'string') {
          expect((caughtError as Error).message).toContain(errorMatcher.message);
        } else {
          expect((caughtError as Error).message).toMatch(errorMatcher.message);
        }
      }
    }
  }
}
