import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
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
      '@tests': resolve('./tests')
    }
  }
});