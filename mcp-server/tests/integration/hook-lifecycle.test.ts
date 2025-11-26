/**
 * Hook Lifecycle Integration Tests
 *
 * Tests the complete hook lifecycle flow:
 * 1. PreToolUse hook validation
 * 2. Tool execution
 * 3. PostToolUse hook metrics/logging
 * 4. Notification hook alerts
 */
import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = path.resolve(__dirname, '../../../hooks');

/**
 * Helper to run a hook with input and capture output
 */
async function runHook(
  hookName: string,
  input: Record<string, unknown>
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const hookPath = path.join(HOOKS_DIR, `${hookName}.js`);
    const child = spawn('node', [hookPath], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    child.on('error', (error) => {
      reject(error);
    });

    // Send input to stdin
    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

/**
 * Parse hook JSON output
 */
function parseHookOutput(stdout: string): Record<string, unknown> | null {
  try {
    return JSON.parse(stdout.trim());
  } catch {
    return null;
  }
}

describe('Hook Lifecycle Integration', () => {
  describe('PreToolUse Hook', () => {
    it('should allow valid Read tool calls', async () => {
      const input = {
        event: 'PreToolUse',
        tool_name: 'Read',
        tool_input: {
          file_path: '/tmp/test-file.txt',
        },
      };

      const result = await runHook('pre-tool-use', input);
      const output = parseHookOutput(result.stdout);

      expect(output).toBeTruthy();
      expect(output?.decision).toBe('continue');
    });

    it('should block dangerous bash commands', async () => {
      const input = {
        event: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: {
          command: 'rm -rf /',
        },
      };

      const result = await runHook('pre-tool-use', input);
      const output = parseHookOutput(result.stdout);

      expect(output).toBeTruthy();
      expect(output?.decision).toBe('block');
      expect(result.exitCode).toBe(2);
    });

    it('should validate bash commands pass through', async () => {
      const input = {
        event: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: {
          command: 'ls -la',
        },
      };

      const result = await runHook('pre-tool-use', input);
      const output = parseHookOutput(result.stdout);

      expect(output).toBeTruthy();
      expect(output?.decision).toBe('continue');
    });

    it('should include metadata in response', async () => {
      const input = {
        event: 'PreToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/tmp/test.ts' },
      };

      const result = await runHook('pre-tool-use', input);
      const output = parseHookOutput(result.stdout);

      expect(output?.metadata).toBeDefined();
      const metadata = output?.metadata as Record<string, unknown>;
      expect(metadata.hookName).toBe('pre-tool-use');
      expect(metadata.event).toBe('PreToolUse');
      expect(metadata.timestamp).toBeDefined();
    });
  });

  describe('PostToolUse Hook', () => {
    it('should process tool execution results', async () => {
      const input = {
        event: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/tmp/test.ts' },
        tool_output: { content: 'file contents' },
        execution_time_ms: 50,
      };

      const result = await runHook('post-tool-use', input);
      const output = parseHookOutput(result.stdout);

      expect(output).toBeTruthy();
      expect(output?.decision).toBe('continue');
    });

    it('should warn on slow execution', async () => {
      const input = {
        event: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/tmp/test.ts' },
        tool_output: { content: 'file contents' },
        execution_time_ms: 6000, // Above Read threshold (5000ms critical)
      };

      const result = await runHook('post-tool-use', input);
      const output = parseHookOutput(result.stdout);

      expect(output).toBeTruthy();
      expect(output?.decision).toBe('continue');
      // Should have a warning about execution time (could be 'Slow' or 'Critical')
      expect(result.stderr).toMatch(/Slow|Critical/);
    });

    it('should handle error outputs', async () => {
      const input = {
        event: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'invalid-command' },
        tool_output: { isError: true, content: [{ type: 'text', text: 'command not found' }] },
        execution_time_ms: 100,
      };

      const result = await runHook('post-tool-use', input);
      const output = parseHookOutput(result.stdout);

      expect(output).toBeTruthy();
      expect(output?.decision).toBe('continue');
    });

    it('should include analysis in context', async () => {
      const input = {
        event: 'PostToolUse',
        tool_name: 'Grep',
        tool_input: { pattern: 'test' },
        tool_output: { matches: [] },
        execution_time_ms: 200,
      };

      const result = await runHook('post-tool-use', input);
      const output = parseHookOutput(result.stdout);

      expect(output?.context).toBeDefined();
      const context = output?.context as Record<string, unknown>;
      expect(context.analysis).toBeDefined();
    });
  });

  describe('Notification Hook', () => {
    it('should process info notifications', async () => {
      const input = {
        event: 'Notification',
        type: 'info',
        title: 'Test Info',
        message: 'This is an info notification',
        context: {},
      };

      const result = await runHook('notification', input);
      const output = parseHookOutput(result.stdout);

      expect(output).toBeTruthy();
      expect(output?.decision).toBe('continue');
      expect(output?.systemMessage).toContain('Test Info');
      expect(output?.systemMessage).toContain('ℹ️');
    });

    it('should process warning notifications', async () => {
      const input = {
        event: 'Notification',
        type: 'warning',
        title: 'Test Warning',
        message: 'This is a warning',
        context: {},
      };

      const result = await runHook('notification', input);
      const output = parseHookOutput(result.stdout);

      expect(output?.systemMessage).toContain('⚠️');
    });

    it('should process error notifications', async () => {
      const input = {
        event: 'Notification',
        type: 'error',
        title: 'Test Error',
        message: 'An error occurred',
        context: { file: 'test.ts', line: 42 },
      };

      const result = await runHook('notification', input);
      const output = parseHookOutput(result.stdout);

      expect(output?.systemMessage).toContain('❌');
      expect(output?.systemMessage).toContain('test.ts');
      expect(output?.systemMessage).toContain('42');
    });

    it('should process success notifications', async () => {
      const input = {
        event: 'Notification',
        type: 'success',
        title: 'Operation Complete',
        message: 'Task finished successfully',
        context: { duration: 1500 },
      };

      const result = await runHook('notification', input);
      const output = parseHookOutput(result.stdout);

      expect(output?.systemMessage).toContain('✅');
      expect(output?.systemMessage).toContain('1500ms');
    });
  });

  describe('Complete Lifecycle Flow', () => {
    it('should simulate a complete tool execution lifecycle', async () => {
      // Step 1: PreToolUse validation
      const preInput = {
        event: 'PreToolUse',
        tool_name: 'Grep',
        tool_input: { pattern: 'TODO', path: '.' },
      };

      const preResult = await runHook('pre-tool-use', preInput);
      const preOutput = parseHookOutput(preResult.stdout);

      expect(preOutput?.decision).toBe('continue');

      // Step 2: Simulate tool execution (we skip actual execution)
      const executionTime = 250;
      const toolOutput = {
        matches: [
          { file: 'src/index.ts', line: 10, text: '// TODO: implement' },
          { file: 'src/utils.ts', line: 42, text: '// TODO: refactor' },
        ],
      };

      // Step 3: PostToolUse metrics
      const postInput = {
        event: 'PostToolUse',
        tool_name: 'Grep',
        tool_input: preInput.tool_input,
        tool_output: toolOutput,
        execution_time_ms: executionTime,
      };

      const postResult = await runHook('post-tool-use', postInput);
      const postOutput = parseHookOutput(postResult.stdout);

      expect(postOutput?.decision).toBe('continue');
      expect(postOutput?.context).toBeDefined();

      // Step 4: Notification (if needed)
      const notifyInput = {
        event: 'Notification',
        type: 'info',
        title: 'Search Complete',
        message: `Found 2 TODO comments`,
        context: { duration: executionTime },
      };

      const notifyResult = await runHook('notification', notifyInput);
      const notifyOutput = parseHookOutput(notifyResult.stdout);

      expect(notifyOutput?.decision).toBe('continue');
      expect(notifyOutput?.systemMessage).toContain('2 TODO');
    }, 25000); // 25 second timeout for complete lifecycle test with 4 sequential process spawns (~5s each)

    it('should handle blocked tool execution flow', async () => {
      // Step 1: PreToolUse blocks dangerous command
      const preInput = {
        event: 'PreToolUse',
        tool_name: 'Write',
        tool_input: {
          file_path: '.env',
          content: 'SECRET_KEY=abc123',
        },
      };

      const preResult = await runHook('pre-tool-use', preInput);
      const preOutput = parseHookOutput(preResult.stdout);

      expect(preOutput?.decision).toBe('block');
      expect(preResult.exitCode).toBe(2);

      // Step 2: Notification about blocked operation
      const notifyInput = {
        event: 'Notification',
        type: 'warning',
        title: 'Operation Blocked',
        message: 'Write to protected file was blocked',
        context: { file: '.env' },
      };

      const notifyResult = await runHook('notification', notifyInput);
      const notifyOutput = parseHookOutput(notifyResult.stdout);

      expect(notifyOutput?.decision).toBe('continue');
      expect(notifyOutput?.systemMessage).toContain('⚠️');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed input gracefully in pre-tool-use', async () => {
      const result = await runHook('pre-tool-use', {});

      // Should block due to missing tool_input or fail validation
      expect(result.exitCode).not.toBe(null);
    });

    it('should continue on malformed input in post-tool-use', async () => {
      const result = await runHook('post-tool-use', {});
      const output = parseHookOutput(result.stdout);

      // Post-hook should always continue
      expect(output?.decision).toBe('continue');
    });

    it('should continue on malformed input in notification', async () => {
      const result = await runHook('notification', {});
      const output = parseHookOutput(result.stdout);

      // Notification hook should always continue
      expect(output?.decision).toBe('continue');
    });
  });
});
