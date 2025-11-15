#!/usr/bin/env node

// MCP Test Client to verify tool recognition
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListToolsResultSchema, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
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

async function testMCPConnection() {
  console.log('=== Testing MCP Connection ===\n');
  
  try {
    // Create transport
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js'],
      env: { ...process.env, NODE_ENV: 'development' }
    });

    // Create client
    const client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect to server
    logger.info('Connecting to MCP server...');
    await client.connect(transport);
    logger.info('Connected to MCP server successfully!');

    // List available tools
    logger.info('Listing available tools...');
    const toolsResult = await client.request(
      { method: 'tools/list' },
      ListToolsResultSchema
    );
    
    console.log('\n=== Available Tools ===');
    console.log(`Found ${toolsResult.tools.length} tools:`);
    
    toolsResult.tools.forEach((tool, index) => {
      console.log(`\n${index + 1}. ${tool.name}`);
      console.log(`   Title: ${tool.title}`);
      console.log(`   Description: ${tool.description}`);
      console.log(`   Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`);
    });

    // Test a simple tool call
    if (toolsResult.tools.length > 0) {
      const firstTool = toolsResult.tools[0];
      console.log(`\n=== Testing Tool: ${firstTool.name} ===`);
      
      try {
        const result = await client.request(
          {
            method: 'tools/call',
            params: {
              name: firstTool.name,
              arguments: { query: 'test query' }
            }
          },
          CallToolResultSchema
        );
        
        console.log('Tool call successful!');
        console.log('Result:', JSON.stringify(result, null, 2));
      } catch (error) {
        console.error('Tool call failed:', error);
      }
    }

    // Close connection
    await client.close();
    logger.info('MCP connection closed.');
    
  } catch (error) {
    logger.error('MCP test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMCPConnection().catch(console.error);