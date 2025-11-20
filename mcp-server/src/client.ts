import axios from 'axios';
import { z } from 'zod';
import winston from 'winston';
import chalk from 'chalk';
import PQueue from 'p-queue';
import * as fs from 'fs';
import * as path from 'path';

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

const MLXServerConfig = z.object({
  host: z.string().default('localhost'),
  port: z.number().int().min(1024).max(65535),
  model: z.string(),
  max_tokens: z.number().int().min(1).max(32768).default(32768),
  temperature: z.number().min(0).max(2).default(1.0),
  top_p: z.number().min(0).max(1).default(0.95),
  top_k: z.number().int().min(1).max(100).default(20),
  repetition_penalty: z.number().min(0).max(2).default(1.0),
  presence_penalty: z.number().min(-2).max(2).default(1.5),
  greedy: z.boolean().default(false),
  out_seq_length: z.number().int().min(1).max(32768).default(32768),
});

type MLXServerConfig = z.infer<typeof MLXServerConfig>;

interface LoadBalancerConnection {
  id: number;
  config: MLXServerConfig;
  healthy: boolean;
  lastUsed: number;
  requestCount: number;
  responseTime: number;
}

export class MLXClient {
  private loadBalancer: LoadBalancerConnection | null = null;
  private queue: PQueue;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.queue = new PQueue({
      concurrency: 27, // Load Balancer manages concurrent instances
      interval: 1000,
      intervalCap: 100,
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing MLX client (connecting to Load Balancer)...');

    let model = 'lmstudio-community/Qwen3-VL-2B-Thinking-MLX-8bit';
    let loadBalancerPort = 8107;

    try {
      // Try to locate config.json relative to CWD or __dirname
      const possiblePaths = [
        path.resolve(process.cwd(), '../mlx-servers/config.json'),
        path.resolve(process.cwd(), 'mlx-servers/config.json'),
        path.resolve(__dirname, '../../mlx-servers/config.json'),
        path.resolve(__dirname, '../../../mlx-servers/config.json')
      ];

      const configPath = possiblePaths.find(p => fs.existsSync(p));

      if (configPath) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (configData.mlx_servers?.model_path) {
          model = configData.mlx_servers.model_path;
        }
        if (typeof configData.mlx_servers?.base_port === 'number') {
          loadBalancerPort = configData.mlx_servers.base_port;
        }
        logger.info(`Loaded config from ${configPath}`);
      } else {
        logger.warn('Config file not found, using defaults');
      }
    } catch (error) {
      logger.warn('Failed to load config, using defaults', error);
    }

    this.loadBalancer = {
      id: 0,
      config: {
        host: 'localhost',
        port: loadBalancerPort,
        model,
        max_tokens: 32768,
        temperature: 1.0,
        top_p: 0.95,
        top_k: 20,
        repetition_penalty: 1.0,
        presence_penalty: 1.5,
        greedy: false,
        out_seq_length: 32768,
      },
      healthy: false,
      lastUsed: Date.now(),
      requestCount: 0,
      responseTime: 0,
    };

    // Perform initial health check
    await this.performHealthCheck();

    if (!this.loadBalancer.healthy) {
      logger.warn(chalk.yellow(`⚠️  Load Balancer not available on port ${loadBalancerPort}`));
      logger.warn(chalk.yellow('Please ensure mlx-servers are running'));
    } else {
      logger.info(chalk.green(`✅ Connected to MLX Load Balancer`));
    }

    // Start health monitoring
    this.startHealthMonitoring();
  }

  async generateCompletion(
    prompt: string,
    options: Partial<MLXServerConfig> = {}
  ): Promise<string> {
    return this.queue.add(async () => {
      if (!this.loadBalancer || !this.loadBalancer.healthy) {
        const msg = 'Load Balancer not available. Please ensure MLX servers are running on port 8090.';
        logger.error(msg);
        throw new Error(msg);
      }

      const startTime = Date.now();

      try {
        const response = await axios.post(
          `http://${this.loadBalancer.config.host}:${this.loadBalancer.config.port}/v1/completions`,
          {
            model: this.loadBalancer.config.model,
            prompt,
            max_tokens: options.max_tokens || this.loadBalancer.config.max_tokens,
            temperature: options.temperature || this.loadBalancer.config.temperature,
            top_p: options.top_p || this.loadBalancer.config.top_p,
            stream: false,
          },
          {
            timeout: 600000, // 600 second timeout
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const responseTime = Date.now() - startTime;

        // Update metrics
        this.loadBalancer.lastUsed = Date.now();
        this.loadBalancer.requestCount++;
        this.loadBalancer.responseTime = responseTime;

        logger.debug(
          `MLX Load Balancer completed request in ${chalk.cyan(responseTime + 'ms')}`
        );

        return response.data.choices[0]?.text || '';

      } catch (error) {
        logger.error(`MLX Load Balancer request failed:`, error);
        if (this.loadBalancer) this.loadBalancer.healthy = false;
        throw error;
      }
    });
  }

  async generateChatCompletion(
    messages: Array<{ role: string; content: string }>,
    options: Partial<MLXServerConfig> = {}
  ): Promise<string> {
    return this.queue.add(async () => {
      if (!this.loadBalancer || !this.loadBalancer.healthy) {
        const msg = 'Load Balancer not available. Please ensure MLX servers are running on port 8090.';
        logger.error(msg);
        throw new Error(msg);
      }

      const startTime = Date.now();

      try {
        const response = await axios.post(
          `http://${this.loadBalancer.config.host}:${this.loadBalancer.config.port}/v1/chat/completions`,
          {
            model: this.loadBalancer.config.model,
            messages,
            max_tokens: options.max_tokens || this.loadBalancer.config.max_tokens,
            temperature: options.temperature || this.loadBalancer.config.temperature,
            top_p: options.top_p || this.loadBalancer.config.top_p,
            stream: false,
          },
          {
            timeout: 600000,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const responseTime = Date.now() - startTime;

        // Update metrics
        this.loadBalancer.lastUsed = Date.now();
        this.loadBalancer.requestCount++;
        this.loadBalancer.responseTime = responseTime;

        logger.debug(
          `MLX Load Balancer completed chat request in ${chalk.cyan(responseTime + 'ms')}`
        );

        return response.data.choices[0]?.message?.content || '';

      } catch (error) {
        logger.error(`MLX Load Balancer chat request failed:`, error);
        if (this.loadBalancer) this.loadBalancer.healthy = false;
        throw error;
      }
    });
  }



  private async performHealthCheck(): Promise<void> {
    if (!this.loadBalancer) return;

    try {
      const response = await axios.get(
        `http://${this.loadBalancer.config.host}:${this.loadBalancer.config.port}/health`,
        { timeout: 5000 }
      );

      if (response.status === 200) {
        this.loadBalancer.healthy = true;
      } else {
        this.loadBalancer.healthy = false;
      }
    } catch (error) {
      this.loadBalancer.healthy = false;
      logger.debug(`MLX Load Balancer on port ${this.loadBalancer.config.port} not available`);
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
      if (this.loadBalancer?.healthy) {
        logger.debug(`Health check: Load Balancer is healthy`);
      } else {
        logger.debug(`Health check: Load Balancer is UNHEALTHY`);
      }
    }, 30000); // Check every 30 seconds
  }

  isAvailable(): boolean {
    return this.loadBalancer?.healthy || false;
  }

  getMetrics() {
    return {
      healthyInstances: this.loadBalancer?.healthy ? 1 : 0,
      totalInstances: 1,
      totalRequests: this.loadBalancer?.requestCount || 0,
      avgResponseTime: this.loadBalancer?.responseTime || 0,
      queueSize: this.queue.size,
      queuePending: this.queue.pending,
    };
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.queue.onIdle();
    logger.info('MLX client shutdown complete');
  }
}
