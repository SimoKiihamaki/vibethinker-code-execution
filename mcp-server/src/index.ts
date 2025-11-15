import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import chalk from 'chalk';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MLXClient } from './client.js';
import { Orchestrator } from './orchestrator.js';
import { ToolRegistry } from './tools/registry.js';
import { ProgressiveDisclosureGenerator } from './progressive-disclosure.js';

const logger = winston.createLogger({
  level: 'info',
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

export class VibeThinkerMCPServer {
  private server: Server;
  private mlxClient: MLXClient;
  private orchestrator: Orchestrator;
  private toolRegistry: ToolRegistry;
  private disclosureGenerator: ProgressiveDisclosureGenerator;

  constructor() {
    this.server = new Server(
      {
        name: 'vibethinker-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          logging: {},
        },
      }
    );

    this.mlxClient = new MLXClient();
    this.orchestrator = new Orchestrator(this.mlxClient);
    this.toolRegistry = new ToolRegistry();
    this.disclosureGenerator = new ProgressiveDisclosureGenerator();

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.info('Listing available tools');

      // Generate progressive disclosure API
      const tools = await this.disclosureGenerator.generateTools();

      logger.info(`Returning ${tools.length} tools to Claude Code`);

      return {
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
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      logger.info(`Calling tool: ${chalk.cyan(name)} with args: ${JSON.stringify(args, null, 2)}`);
      
      try {
        // Progressive disclosure: only load what's needed
        logger.debug(`Loading tool: ${name}`);
        const tool = await this.disclosureGenerator.loadTool(name);
        
        if (!tool) {
          logger.error(`Tool not found: ${name}`);
          throw new Error(`Tool not found: ${name}`);
        }

        logger.debug(`Tool loaded successfully: ${name}, executing through orchestrator`);
        
        const rawData = await this.toolRegistry.executeTool(name, args || {});
        logger.info(`Tool ${chalk.cyan(name)} executed via registry`);
        const response = {
          success: true,
          data: rawData,
          metadata: {
            executionTime: 0,
            tokensUsed: 0,
            cacheHit: false,
          },
        };
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Tool ${chalk.cyan(name)} failed:`, error);

        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      logger.error('Server error:', error);
    };

    process.on('SIGINT', async () => {
      logger.info('Shutting down server...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down server...');
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    try {
      logger.info(chalk.green('🚀 Starting VibeThinker MCP Server...'));
      
      // Initialize MLX client
      await this.mlxClient.initialize();
      
      // Generate progressive disclosure API
      await this.disclosureGenerator.generateAPI();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info(chalk.green('✅ VibeThinker MCP Server is running'));
      logger.info(chalk.blue('Waiting for Claude Code connections...'));
      
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new VibeThinkerMCPServer();
server.run().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});