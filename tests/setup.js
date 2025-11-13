// Test setup file for Vitest
import { vi } from 'vitest';

// Mock environment variables
process.env.MLX_SERVER_URL = 'http://localhost:8080';
process.env.MLX_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';

// Global test configuration
global.testTimeout = 60000;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn()
};

// Mock process.exit to prevent tests from exiting
vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// Mock child_process spawn for testing
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn()
  }))
}));