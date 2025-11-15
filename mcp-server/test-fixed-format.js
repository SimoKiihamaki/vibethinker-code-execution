#!/usr/bin/env node

// Test script to verify MCP tool format after fixes
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import winston from 'winston';
import chalk from 'chalk';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${chalk.gray(timestamp)} ${level} ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'],
    }),
  ],
});

// Simulate the fixed tool structure
const testTool = {
  name: 'searchByQuery',
  description: 'Search repository by natural language query using ripgrep and semantic understanding',
  category: 'repo-search',
  complexity: 'moderate',
  tags: ['search', 'ripgrep', 'semantic'],
  inputSchema: z.object({
    query: z.string().describe('Natural language search query'),
    fileTypes: z.array(z.string()).optional().describe('File extensions to search (e.g., [".ts", ".tsx"])'),
    maxResults: z.number().int().min(1).max(100).default(20).describe('Maximum number of results'),
    contextLines: z.number().int().min(0).max(10).default(3).describe('Lines of context around matches'),
  })
};

console.log('=== Testing Fixed MCP Tool Format ===\n');

// Simulate the fixed implementation
const tools = [testTool];

const result = {
  tools: tools.map(tool => {
    // Convert Zod schema to JSON Schema
    const jsonSchemaDoc = zodToJsonSchema(tool.inputSchema, tool.name);
    
    // Extract the actual schema definition (not the $ref document)
    const inputSchema = jsonSchemaDoc.definitions?.[tool.name] || jsonSchemaDoc;
    
    // Generate a title from the tool name (capitalize and add spaces)
    const title = tool.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
    
    logger.debug(`Tool: ${tool.name}, Title: ${title}, Schema keys: ${Object.keys(inputSchema)}`);

    return {
      name: tool.name,
      title: title,
      description: tool.description,
      inputSchema: inputSchema,
    };
  }),
};

console.log('=== Fixed MCP Tool Format ===');
console.log(JSON.stringify(result, null, 2));

// Verify the format matches MCP specification
const mcpTool = result.tools[0];
console.log('\n=== MCP Format Validation ===');
console.log('✅ Has name field:', !!mcpTool.name);
console.log('✅ Has title field:', !!mcpTool.title);
console.log('✅ Has description field:', !!mcpTool.description);
console.log('✅ Has inputSchema field:', !!mcpTool.inputSchema);
console.log('✅ inputSchema has type:', !!mcpTool.inputSchema.type);
console.log('✅ inputSchema has properties:', !!mcpTool.inputSchema.properties);
console.log('✅ inputSchema has required:', !!mcpTool.inputSchema.required);
console.log('✅ No $ref in schema:', !mcpTool.inputSchema.$ref);

console.log('\n=== Tool Title Examples ===');
const testNames = ['searchByQuery', 'findDependencies', 'analyzeImports', 'buildGraph'];
testNames.forEach(name => {
  const title = name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  console.log(`${name} -> "${title}"`);
});