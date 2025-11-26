/**
 * Tool Test Context Factory
 *
 * Creates test contexts for tool execution testing
 */
import { vi } from 'vitest';
import { createMockMLXClient, type MockMLXClient } from './mlx-client.js';

/**
 * Tool test context configuration
 */
export interface ToolTestContextConfig {
  /** Tool name being tested */
  toolName: string;
  /** Mock MLX client configuration */
  mlxConfig?: Parameters<typeof createMockMLXClient>[0];
  /** Working directory for tests */
  workingDirectory?: string;
  /** Whether to mock file system */
  mockFileSystem?: boolean;
}

/**
 * Mock file system entry
 */
export interface MockFsEntry {
  path: string;
  content: string;
  isDirectory?: boolean;
}

/**
 * Tool test context
 */
export interface ToolTestContext {
  /** Mock MLX client */
  mlxClient: MockMLXClient;
  /** Tool name */
  toolName: string;
  /** Working directory */
  workingDirectory: string;
  /** Mock file system */
  mockFs: Map<string, MockFsEntry>;
  /** Add a mock file */
  addMockFile: (path: string, content: string) => void;
  /** Add a mock directory */
  addMockDirectory: (path: string) => void;
  /** Get mock file content */
  getMockFile: (path: string) => string | undefined;
  /** Check if mock path exists */
  mockPathExists: (path: string) => boolean;
  /** Reset the context */
  reset: () => void;
  /** Cleanup resources */
  cleanup: () => void;
}

/**
 * Create a test context for tool testing
 */
export function createToolTestContext(config: ToolTestContextConfig): ToolTestContext {
  const {
    toolName,
    mlxConfig = {},
    workingDirectory = '/test/project',
  } = config;

  const mlxClient = createMockMLXClient(mlxConfig);
  const mockFs = new Map<string, MockFsEntry>();

  const context: ToolTestContext = {
    mlxClient,
    toolName,
    workingDirectory,
    mockFs,

    addMockFile(path: string, content: string) {
      mockFs.set(path, { path, content, isDirectory: false });
    },

    addMockDirectory(path: string) {
      mockFs.set(path, { path, content: '', isDirectory: true });
    },

    getMockFile(path: string) {
      const entry = mockFs.get(path);
      return entry?.isDirectory ? undefined : entry?.content;
    },

    mockPathExists(path: string) {
      return mockFs.has(path);
    },

    reset() {
      mlxClient._reset();
      mockFs.clear();
    },

    cleanup() {
      mlxClient._reset();
      mockFs.clear();
    },
  };

  return context;
}

/**
 * Create a test context with common mock files for code analysis
 */
export function createCodeAnalysisTestContext(toolName: string): ToolTestContext {
  const context = createToolTestContext({ toolName });

  // Add common mock files for code analysis
  context.addMockFile('/test/project/src/index.ts', `
import { foo } from './utils';

export function main() {
  console.log(foo());
}
`);

  context.addMockFile('/test/project/src/utils.ts', `
export function foo(): string {
  return 'hello';
}

export function bar(x: number): number {
  if (x > 0) {
    return x * 2;
  }
  return 0;
}
`);

  context.addMockFile('/test/project/package.json', JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    dependencies: {
      typescript: '^5.0.0',
    },
  }, null, 2));

  context.addMockDirectory('/test/project/src');
  context.addMockDirectory('/test/project/node_modules');

  return context;
}

/**
 * Create a test context with mock repository structure
 */
export function createRepoSearchTestContext(toolName: string): ToolTestContext {
  const context = createToolTestContext({ toolName });

  // Add mock repository structure
  context.addMockDirectory('/test/project/src');
  context.addMockDirectory('/test/project/src/components');
  context.addMockDirectory('/test/project/src/utils');
  context.addMockDirectory('/test/project/tests');

  context.addMockFile('/test/project/src/components/Button.tsx', `
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};
`);

  context.addMockFile('/test/project/src/utils/helpers.ts', `
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
`);

  context.addMockFile('/test/project/tests/button.test.tsx', `
import { render } from '@testing-library/react';
import { Button } from '../src/components/Button';

describe('Button', () => {
  it('renders correctly', () => {
    const { getByText } = render(<Button label="Click me" onClick={() => {}} />);
    expect(getByText('Click me')).toBeInTheDocument();
  });
});
`);

  return context;
}
