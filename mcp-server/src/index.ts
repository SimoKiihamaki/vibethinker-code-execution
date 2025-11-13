import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import chalk from 'chalk';
import { z } from 'zod';
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
  transports: [new winston.transports.Console()],
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
      
      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      logger.info(`Calling tool: ${chalk.cyan(name)}`);
      
      try {
        // Progressive disclosure: only load what's needed
        const tool = await this.disclosureGenerator.loadTool(name);
        
        if (!tool) {
          throw new Error(`Tool not found: ${name}`);
        }

        // Orchestrate through MLX backend
        const result = await this.orchestrator.executeTool(tool, args);
        
        logger.info(`Tool ${chalk.cyan(name)} completed successfully`);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error(`Tool ${chalk.cyan(name)} failed:`, error);
        
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${error.message}`,
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