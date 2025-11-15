#!/usr/bin/env node

// Test script to verify MCP tool format
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Simulate the current tool structure
const testTool = {
  name: 'searchByQuery',
  description: 'Search repository by natural language query using ripgrep and semantic understanding',
  inputSchema: z.object({
    query: z.string().describe('Natural language search query'),
    fileTypes: z.array(z.string()).optional().describe('File extensions to search (e.g., [".ts", ".tsx"])'),
    maxResults: z.number().int().min(1).max(100).default(20).describe('Maximum number of results'),
    contextLines: z.number().int().min(0).max(10).default(3).describe('Lines of context around matches'),
  })
};

console.log('=== Current Tool Structure ===');
console.log(JSON.stringify(testTool, null, 2));

console.log('\n=== Current inputSchema (zodToJsonSchema) ===');
const currentSchema = zodToJsonSchema(testTool.inputSchema, testTool.name);
console.log(JSON.stringify(currentSchema, null, 2));

console.log('\n=== Expected MCP Tool Format ===');
const expectedTool = {
  name: testTool.name,
  title: 'Repository Search Tool', // Missing in current implementation
  description: testTool.description,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language search query' },
      fileTypes: { type: 'array', items: { type: 'string' }, description: 'File extensions to search (e.g., [".ts", ".tsx"])' },
      maxResults: { type: 'number', minimum: 1, maximum: 100, default: 20, description: 'Maximum number of results' },
      contextLines: { type: 'number', minimum: 0, maximum: 10, default: 3, description: 'Lines of context around matches' }
    },
    required: ['query'] // This should be calculated
  }
};
console.log(JSON.stringify(expectedTool, null, 2));