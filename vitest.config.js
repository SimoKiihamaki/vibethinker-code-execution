import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/test-repo/**',
      '**/test-repo-optimized/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'dist/**',
        'scripts/**',
        '*.config.js',
        '*.config.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve('./src'),
      '@mcp': resolve('./mcp-server/src'),
      '@mlx': resolve('./mlx-servers'),
      '@hooks': resolve('./hooks'),
      '@skills': resolve('./skills'),
      '@tests': resolve('./tests'),
      '@mlx-agentic-rag/sdk': resolve('./mcp-server/src/client.ts')
    }
  }
});