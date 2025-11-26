/**
 * Mock MLX Client for Testing
 *
 * Provides a mock implementation of MLXClient for unit tests
 * without requiring actual MLX server connections.
 */
import { vi } from 'vitest';

/**
 * Mock response configuration
 */
export interface MockResponseConfig {
  /** Default response text */
  defaultResponse?: string;
  /** Response delay in milliseconds */
  delay?: number;
  /** Whether to simulate errors */
  shouldError?: boolean;
  /** Error message when shouldError is true */
  errorMessage?: string;
  /** Custom responses by prompt pattern */
  responseMap?: Map<string | RegExp, string>;
}

/**
 * Mock MLX Client metrics
 */
export interface MockMetrics {
  healthyInstances: number;
  totalInstances: number;
  totalRequests: number;
  avgResponseTime: number;
  queueSize: number;
  queuePending: number;
}

/**
 * Create a mock MLX client for testing
 */
export function createMockMLXClient(config: MockResponseConfig = {}) {
  const {
    defaultResponse = 'Mock MLX response',
    delay = 0,
    shouldError = false,
    errorMessage = 'Mock MLX error',
    responseMap = new Map(),
  } = config;

  let requestCount = 0;
  let isHealthy = true;

  const findResponse = (prompt: string): string => {
    for (const [pattern, response] of responseMap) {
      if (typeof pattern === 'string' && prompt.includes(pattern)) {
        return response;
      }
      if (pattern instanceof RegExp && pattern.test(prompt)) {
        return response;
      }
    }
    return defaultResponse;
  };

  const mockClient = {
    initialize: vi.fn().mockImplementation(async () => {
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
      isHealthy = true;
    }),

    generateCompletion: vi.fn().mockImplementation(async (prompt: string) => {
      requestCount++;

      if (delay > 0) await new Promise(r => setTimeout(r, delay));

      if (shouldError) {
        throw new Error(errorMessage);
      }

      return findResponse(prompt);
    }),

    generateChatCompletion: vi.fn().mockImplementation(
      async (messages: Array<{ role: string; content: string }>) => {
        requestCount++;

        if (delay > 0) await new Promise(r => setTimeout(r, delay));

        if (shouldError) {
          throw new Error(errorMessage);
        }

        const lastUserMessage = messages.findLast(m => m.role === 'user');
        return findResponse(lastUserMessage?.content || '');
      }
    ),

    isAvailable: vi.fn().mockImplementation(() => isHealthy),

    getMetrics: vi.fn().mockImplementation((): MockMetrics => ({
      healthyInstances: isHealthy ? 1 : 0,
      totalInstances: 1,
      totalRequests: requestCount,
      avgResponseTime: delay || 100,
      queueSize: 0,
      queuePending: 0,
    })),

    shutdown: vi.fn().mockImplementation(async () => {
      isHealthy = false;
    }),

    // Test helpers
    _setHealthy: (healthy: boolean) => {
      isHealthy = healthy;
    },
    _getRequestCount: () => requestCount,
    _reset: () => {
      requestCount = 0;
      isHealthy = true;
      mockClient.initialize.mockClear();
      mockClient.generateCompletion.mockClear();
      mockClient.generateChatCompletion.mockClear();
      mockClient.isAvailable.mockClear();
      mockClient.getMetrics.mockClear();
      mockClient.shutdown.mockClear();
    },
  };

  return mockClient;
}

/**
 * Create a mock MLX client that returns JSON responses
 */
export function createJsonMockMLXClient(defaultJson: Record<string, unknown> = {}) {
  return createMockMLXClient({
    defaultResponse: JSON.stringify(defaultJson),
    responseMap: new Map(),
  });
}

/**
 * Create a mock MLX client that simulates slow responses
 */
export function createSlowMockMLXClient(delayMs: number = 1000) {
  return createMockMLXClient({
    delay: delayMs,
  });
}

/**
 * Create a mock MLX client that always fails
 */
export function createFailingMockMLXClient(errorMessage: string = 'MLX unavailable') {
  return createMockMLXClient({
    shouldError: true,
    errorMessage,
  });
}

export type MockMLXClient = ReturnType<typeof createMockMLXClient>;
