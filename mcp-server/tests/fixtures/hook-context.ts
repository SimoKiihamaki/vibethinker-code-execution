/**
 * Hook Test Context Factory
 *
 * Creates test contexts for Claude Code hook testing
 */
import { vi } from 'vitest';

/**
 * Hook event types
 */
export type HookEvent =
  | 'SessionStart'
  | 'SessionStop'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'Stop'
  | 'PreToolResponse'
  | 'PostToolResponse';

/**
 * Hook decision types
 */
export type HookDecision = 'continue' | 'block';

/**
 * Hook test input
 */
export interface HookTestInput<T = unknown> {
  event: HookEvent;
  payload: T;
  sessionId?: string;
  timestamp?: string;
}

/**
 * Expected hook output (JSON decision protocol)
 */
export interface HookExpectedOutput {
  decision: HookDecision;
  reason: string;
  systemMessage?: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * PreToolUse payload
 */
export interface PreToolUsePayload {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

/**
 * PostToolUse payload
 */
export interface PostToolUsePayload {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: unknown;
  execution_time_ms: number;
}

/**
 * SessionStart payload
 */
export interface SessionStartPayload {
  session_id: string;
  working_directory: string;
}

/**
 * SessionStop payload
 */
export interface SessionStopPayload {
  session_id: string;
  duration_ms: number;
}

/**
 * Hook test context
 */
export interface HookTestContext<T = unknown> {
  /** Input to pass to the hook */
  input: HookTestInput<T>;
  /** Expected output from the hook */
  expectedOutput?: HookExpectedOutput;
  /** Mock stdin content */
  stdinContent: string;
  /** Captured stdout */
  stdout: string[];
  /** Captured stderr */
  stderr: string[];
  /** Mock process.exit */
  mockExit: ReturnType<typeof vi.fn>;
  /** Simulate hook execution */
  simulateExecution: () => Promise<HookExpectedOutput | null>;
  /** Reset the context */
  reset: () => void;
}

/**
 * Create a hook test context
 */
export function createHookTestContext<T>(
  event: HookEvent,
  payload: T,
  options?: {
    sessionId?: string;
    expectedDecision?: HookDecision;
    expectedReason?: string;
  }
): HookTestContext<T> {
  const input: HookTestInput<T> = {
    event,
    payload,
    sessionId: options?.sessionId || 'test-session-123',
    timestamp: new Date().toISOString(),
  };

  const expectedOutput: HookExpectedOutput | undefined = options?.expectedDecision
    ? {
        decision: options.expectedDecision,
        reason: options.expectedReason || 'Test reason',
      }
    : undefined;

  const stdout: string[] = [];
  const stderr: string[] = [];
  const mockExit = vi.fn();

  const context: HookTestContext<T> = {
    input,
    expectedOutput,
    stdinContent: JSON.stringify(input),
    stdout,
    stderr,
    mockExit,

    async simulateExecution(): Promise<HookExpectedOutput | null> {
      // Simulate parsing stdout as JSON decision protocol
      const lastStdout = stdout[stdout.length - 1];
      if (!lastStdout) return null;

      try {
        return JSON.parse(lastStdout) as HookExpectedOutput;
      } catch {
        return null;
      }
    },

    reset() {
      stdout.length = 0;
      stderr.length = 0;
      mockExit.mockClear();
    },
  };

  return context;
}

/**
 * Create a PreToolUse hook test context
 */
export function createPreToolUseContext(
  toolName: string,
  toolInput: Record<string, unknown>,
  options?: {
    shouldBlock?: boolean;
    blockReason?: string;
  }
): HookTestContext<PreToolUsePayload> {
  return createHookTestContext<PreToolUsePayload>(
    'PreToolUse',
    {
      tool_name: toolName,
      tool_input: toolInput,
    },
    {
      expectedDecision: options?.shouldBlock ? 'block' : 'continue',
      expectedReason: options?.blockReason,
    }
  );
}

/**
 * Create a PostToolUse hook test context
 */
export function createPostToolUseContext(
  toolName: string,
  toolInput: Record<string, unknown>,
  toolOutput: unknown,
  executionTimeMs: number = 100
): HookTestContext<PostToolUsePayload> {
  return createHookTestContext<PostToolUsePayload>(
    'PostToolUse',
    {
      tool_name: toolName,
      tool_input: toolInput,
      tool_output: toolOutput,
      execution_time_ms: executionTimeMs,
    },
    {
      expectedDecision: 'continue',
    }
  );
}

/**
 * Create a SessionStart hook test context
 */
export function createSessionStartContext(
  workingDirectory: string = '/test/project'
): HookTestContext<SessionStartPayload> {
  return createHookTestContext<SessionStartPayload>(
    'SessionStart',
    {
      session_id: `session-${Date.now()}`,
      working_directory: workingDirectory,
    },
    {
      expectedDecision: 'continue',
    }
  );
}

/**
 * Create a SessionStop hook test context
 */
export function createSessionStopContext(
  durationMs: number = 60000
): HookTestContext<SessionStopPayload> {
  return createHookTestContext<SessionStopPayload>(
    'SessionStop',
    {
      session_id: `session-${Date.now()}`,
      duration_ms: durationMs,
    },
    {
      expectedDecision: 'continue',
    }
  );
}

/**
 * Validate hook output against JSON decision protocol
 */
export function validateHookOutput(output: unknown): output is HookExpectedOutput {
  if (!output || typeof output !== 'object') return false;

  const obj = output as Record<string, unknown>;

  return (
    (obj.decision === 'continue' || obj.decision === 'block') &&
    typeof obj.reason === 'string'
  );
}
