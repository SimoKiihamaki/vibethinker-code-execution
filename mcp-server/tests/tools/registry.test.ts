/**
 * ToolRegistry Unit Tests
 *
 * Tests for the enhanced tool registry with structured error handling and metrics
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { ToolRegistry, ToolRegistryError } from '../../src/tools/registry.js';
import { ToolDefinition } from '../../src/tools/types.js';

// Create mock tool definitions
const createMockTool = (name: string, options?: Partial<ToolDefinition>): ToolDefinition => ({
  name,
  description: `Mock tool: ${name}`,
  category: 'test',
  version: '1.0.0',
  inputSchema: z.object({
    input: z.string().optional(),
  }),
  handler: options?.handler ?? (async (args) => ({ result: 'success', args })),
  tags: ['test'],
  complexity: 'simple',
  externalDependencies: [],
  npmDependencies: [],
  internalDependencies: [],
  ...options,
});

// Mock the tool definitions modules
vi.mock('../../src/tools/definitions/repo-search/index.js', () => ({}));
vi.mock('../../src/tools/definitions/code-analysis/index.js', () => ({}));
vi.mock('../../src/tools/definitions/architectural/index.js', () => ({}));
vi.mock('../../src/tools/definitions/context-building/index.js', () => ({}));
vi.mock('../../src/tools/utils.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/tools/utils.js')>();
  return {
    ...original,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ToolRegistry();
  });

  describe('Tool Registration', () => {
    it('should register a tool successfully', () => {
      const tool = createMockTool('testTool');
      registry.registerTool(tool);

      expect(registry.getTool('testTool')).toBe(tool);
    });

    it('should store tool in correct category', () => {
      const tool = createMockTool('categoryTool', { category: 'my-category' });
      registry.registerTool(tool);

      const categoryTools = registry.getToolsByCategory('my-category');
      expect(categoryTools).toContain(tool);
    });

    it('should get all registered tools', () => {
      const tool1 = createMockTool('tool1');
      const tool2 = createMockTool('tool2');

      registry.registerTool(tool1);
      registry.registerTool(tool2);

      const allTools = registry.getAllTools();
      expect(allTools).toContain(tool1);
      expect(allTools).toContain(tool2);
    });

    it('should return undefined for non-existent tool', () => {
      expect(registry.getTool('nonExistent')).toBeUndefined();
    });

    it('should return empty array for non-existent category', () => {
      expect(registry.getToolsByCategory('nonExistent')).toEqual([]);
    });
  });

  describe('Tool Search', () => {
    it('should find tools by name', () => {
      const tool = createMockTool('searchableTool');
      registry.registerTool(tool);

      const results = registry.searchTools('searchable');
      expect(results).toContain(tool);
    });

    it('should find tools by description', () => {
      const tool = createMockTool('myTool', { description: 'Unique description for testing' });
      registry.registerTool(tool);

      const results = registry.searchTools('unique description');
      expect(results).toContain(tool);
    });

    it('should find tools by tags', () => {
      const tool = createMockTool('taggedTool', { tags: ['special', 'unique'] });
      registry.registerTool(tool);

      const results = registry.searchTools('special');
      expect(results).toContain(tool);
    });

    it('should be case-insensitive', () => {
      const tool = createMockTool('CamelCaseTool');
      registry.registerTool(tool);

      const results = registry.searchTools('camelcase');
      expect(results).toContain(tool);
    });

    it('should return empty array for no matches', () => {
      const results = registry.searchTools('zzzznonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('Tool Execution - Success Cases', () => {
    it('should execute tool and return structured result', async () => {
      const tool = createMockTool('executableTool', {
        handler: async (args) => ({ message: 'executed', args }),
      });
      registry.registerTool(tool);

      const result = await registry.executeTool('executableTool', { input: 'test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'executed', args: { input: 'test' } });
      expect(result.metadata?.executionTime).toBeDefined();
    });

    it('should include execution time in metadata', async () => {
      const tool = createMockTool('timedTool', {
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { done: true };
        },
      });
      registry.registerTool(tool);

      const result = await registry.executeTool('timedTool', {});

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(10);
    });

    it('should include tool version in metadata', async () => {
      const tool = createMockTool('versionedTool', { version: '2.0.0' });
      registry.registerTool(tool);

      const result = await registry.executeTool('versionedTool', {});

      expect(result.success).toBe(true);
      expect(result.metadata?.toolVersion).toBe('2.0.0');
    });
  });

  describe('Tool Execution - Error Cases', () => {
    it('should return failure for non-existent tool', async () => {
      const result = await registry.executeTool('nonExistentTool', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_NOT_FOUND');
      expect(result.error?.message).toContain('nonExistentTool');
      expect(result.error?.recoveryHint).toBeDefined();
    });

    it('should return validation error for invalid input', async () => {
      const tool = createMockTool('strictTool', {
        inputSchema: z.object({
          required: z.string(),
        }),
      });
      registry.registerTool(tool);

      const result = await registry.executeTool('strictTool', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_VALIDATION_ERROR');
      expect(result.error?.message).toContain('Validation failed');
    });

    it('should return execution error when handler throws', async () => {
      const tool = createMockTool('failingTool', {
        handler: async () => {
          throw new Error('Handler failed');
        },
      });
      registry.registerTool(tool);

      const result = await registry.executeTool('failingTool', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_EXECUTION_ERROR');
      expect(result.error?.message).toContain('Handler failed');
    });

    it('should infer PATH_NOT_FOUND error code', async () => {
      const tool = createMockTool('pathTool', {
        handler: async () => {
          throw new Error('File not found: /some/path');
        },
      });
      registry.registerTool(tool);

      const result = await registry.executeTool('pathTool', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PATH_NOT_FOUND');
    });

    it('should infer TOOL_TIMEOUT error code', async () => {
      const tool = createMockTool('timeoutTool', {
        handler: async () => {
          throw new Error('Operation timeout exceeded');
        },
      });
      registry.registerTool(tool);

      const result = await registry.executeTool('timeoutTool', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_TIMEOUT');
    });
  });

  describe('executeToolOrThrow', () => {
    it('should return data directly on success', async () => {
      const tool = createMockTool('directTool', {
        handler: async () => ({ value: 42 }),
      });
      registry.registerTool(tool);

      const result = await registry.executeToolOrThrow('directTool', {});

      expect(result).toEqual({ value: 42 });
    });

    it('should throw ToolRegistryError on failure', async () => {
      const tool = createMockTool('throwingTool', {
        handler: async () => {
          throw new Error('Execution failed');
        },
      });
      registry.registerTool(tool);

      await expect(registry.executeToolOrThrow('throwingTool', {})).rejects.toThrow(ToolRegistryError);
    });

    it('should throw for non-existent tool', async () => {
      await expect(registry.executeToolOrThrow('missing', {})).rejects.toThrow(ToolRegistryError);
    });
  });

  describe('Metrics Tracking', () => {
    it('should track successful executions', async () => {
      const tool = createMockTool('metricsTool');
      registry.registerTool(tool);

      await registry.executeTool('metricsTool', {});
      await registry.executeTool('metricsTool', {});

      const metrics = registry.getToolMetrics('metricsTool');
      expect(metrics?.totalCalls).toBe(2);
      expect(metrics?.successCount).toBe(2);
      expect(metrics?.failureCount).toBe(0);
    });

    it('should track failed executions', async () => {
      const tool = createMockTool('failingMetricsTool', {
        handler: async () => {
          throw new Error('Fail');
        },
      });
      registry.registerTool(tool);

      await registry.executeTool('failingMetricsTool', {});

      const metrics = registry.getToolMetrics('failingMetricsTool');
      expect(metrics?.totalCalls).toBe(1);
      expect(metrics?.successCount).toBe(0);
      expect(metrics?.failureCount).toBe(1);
      expect(metrics?.lastError).toBeDefined();
    });

    it('should calculate average execution time', async () => {
      const tool = createMockTool('avgTimeTool', {
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          return {};
        },
      });
      registry.registerTool(tool);

      await registry.executeTool('avgTimeTool', {});
      await registry.executeTool('avgTimeTool', {});

      const metrics = registry.getToolMetrics('avgTimeTool');
      expect(metrics?.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should return undefined for tool without metrics', () => {
      expect(registry.getToolMetrics('nonExistent')).toBeUndefined();
    });

    it('should get all tool metrics', async () => {
      const tool1 = createMockTool('tool1');
      const tool2 = createMockTool('tool2');
      registry.registerTool(tool1);
      registry.registerTool(tool2);

      await registry.executeTool('tool1', {});
      await registry.executeTool('tool2', {});

      const allMetrics = registry.getAllToolMetrics();
      expect(allMetrics.has('tool1')).toBe(true);
      expect(allMetrics.has('tool2')).toBe(true);
    });
  });

  describe('Aggregated Metrics', () => {
    it('should calculate aggregated metrics', async () => {
      const successTool = createMockTool('successTool');
      const failTool = createMockTool('failTool', {
        handler: async () => {
          throw new Error('Fail');
        },
      });
      registry.registerTool(successTool);
      registry.registerTool(failTool);

      await registry.executeTool('successTool', {});
      await registry.executeTool('successTool', {});
      await registry.executeTool('failTool', {});

      const aggregated = registry.getAggregatedMetrics();
      expect(aggregated.totalCalls).toBe(3);
      expect(aggregated.totalSuccesses).toBe(2);
      expect(aggregated.totalFailures).toBe(1);
      expect(aggregated.successRate).toBeCloseTo(0.667, 2);
    });

    it('should return 100% success rate when no calls', () => {
      const aggregated = registry.getAggregatedMetrics();
      expect(aggregated.successRate).toBe(1);
    });

    it('should list tools with errors', async () => {
      const failTool = createMockTool('errorTool', {
        handler: async () => {
          throw new Error('Fail');
        },
      });
      registry.registerTool(failTool);

      await registry.executeTool('errorTool', {});

      const aggregated = registry.getAggregatedMetrics();
      expect(aggregated.toolsWithErrors).toContain('errorTool');
    });
  });

  describe('Reset Metrics', () => {
    it('should reset metrics for specific tool', async () => {
      const tool = createMockTool('resetTool');
      registry.registerTool(tool);

      await registry.executeTool('resetTool', {});
      expect(registry.getToolMetrics('resetTool')).toBeDefined();

      registry.resetMetrics('resetTool');
      expect(registry.getToolMetrics('resetTool')).toBeUndefined();
    });

    it('should reset all metrics', async () => {
      const tool1 = createMockTool('tool1');
      const tool2 = createMockTool('tool2');
      registry.registerTool(tool1);
      registry.registerTool(tool2);

      await registry.executeTool('tool1', {});
      await registry.executeTool('tool2', {});

      registry.resetMetrics();

      expect(registry.getToolMetrics('tool1')).toBeUndefined();
      expect(registry.getToolMetrics('tool2')).toBeUndefined();
    });
  });

  describe('Health Check', () => {
    it('should report healthy when no issues', async () => {
      const tool = createMockTool('healthyTool');
      registry.registerTool(tool);

      for (let i = 0; i < 10; i++) {
        await registry.executeTool('healthyTool', {});
      }

      const health = registry.isHealthy();
      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    it('should report unhealthy when high failure rate', async () => {
      const failTool = createMockTool('unhealthyTool', {
        handler: async () => {
          throw new Error('Fail');
        },
      });
      registry.registerTool(failTool);

      for (let i = 0; i < 10; i++) {
        await registry.executeTool('unhealthyTool', {});
      }

      const health = registry.isHealthy();
      expect(health.healthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues.some(issue => issue.includes('high failure rate'))).toBe(true);
    });

    it('should report low overall success rate', async () => {
      const failTool = createMockTool('lowSuccessTool', {
        handler: async () => {
          throw new Error('Fail');
        },
      });
      registry.registerTool(failTool);

      for (let i = 0; i < 15; i++) {
        await registry.executeTool('lowSuccessTool', {});
      }

      const health = registry.isHealthy();
      expect(health.issues.some(issue => issue.includes('Overall success rate'))).toBe(true);
    });
  });

  describe('Tool Stats', () => {
    it('should return basic stats', () => {
      const tool1 = createMockTool('statTool1', { category: 'cat1' });
      const tool2 = createMockTool('statTool2', { category: 'cat2' });
      registry.registerTool(tool1);
      registry.registerTool(tool2);

      const stats = registry.getToolStats();
      expect(stats.total).toBe(2);
      expect(stats.categories).toBe(2);
      expect(stats.category_cat1).toBe(1);
      expect(stats.category_cat2).toBe(1);
    });
  });

  describe('Categories', () => {
    it('should list all categories', () => {
      const tool1 = createMockTool('catTool1', { category: 'alpha' });
      const tool2 = createMockTool('catTool2', { category: 'beta' });
      registry.registerTool(tool1);
      registry.registerTool(tool2);

      const categories = registry.getCategories();
      expect(categories).toContain('alpha');
      expect(categories).toContain('beta');
    });
  });
});

describe('ToolRegistryError', () => {
  it('should create error with code and message', () => {
    const error = new ToolRegistryError('TOOL_NOT_FOUND', 'Tool missing');

    expect(error.code).toBe('TOOL_NOT_FOUND');
    expect(error.message).toBe('Tool missing');
    expect(error.name).toBe('ToolRegistryError');
  });

  it('should include recovery hint', () => {
    const error = new ToolRegistryError('TOOL_NOT_FOUND', 'Tool missing', {
      recoveryHint: 'Check tool name',
    });

    expect(error.recoveryHint).toBe('Check tool name');
  });

  it('should include context', () => {
    const error = new ToolRegistryError('TOOL_NOT_FOUND', 'Tool missing', {
      context: { toolName: 'myTool' },
    });

    expect(error.context).toEqual({ toolName: 'myTool' });
  });

  it('should convert to structured error', () => {
    const error = new ToolRegistryError('TOOL_NOT_FOUND', 'Tool missing', {
      recoveryHint: 'Check name',
      context: { key: 'value' },
    });

    const structured = error.toStructuredError();

    expect(structured.code).toBe('TOOL_NOT_FOUND');
    expect(structured.message).toBe('Tool missing');
    expect(structured.recoveryHint).toBe('Check name');
    expect(structured.context).toEqual({ key: 'value' });
    expect(structured.timestamp).toBeDefined();
  });

  it('should include timestamp', () => {
    const before = new Date().toISOString();
    const error = new ToolRegistryError('TOOL_NOT_FOUND', 'Tool missing');
    const after = new Date().toISOString();

    expect(error.timestamp >= before).toBe(true);
    expect(error.timestamp <= after).toBe(true);
  });
});
