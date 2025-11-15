import axios from 'axios';
import { z } from 'zod';
import winston from 'winston';
import chalk from 'chalk';
import PQueue from 'p-queue';

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

interface MLXInstance {
  id: number;
  config: MLXServerConfig;
  healthy: boolean;
  lastUsed: number;
  requestCount: number;
  responseTime: number;
}

export class MLXClient {
  private instances: MLXInstance[] = [];
  private queue: PQueue;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.queue = new PQueue({
      concurrency: 27, // 27 concurrent MLX instances
      interval: 1000,
      intervalCap: 100,
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing MLX client with 27 instances...');

    // Create 27 MLX instances on ports 8107-8133
    for (let i = 0; i < 27; i++) {
      const port = 8107 + i;
      const instance: MLXInstance = {
        id: i,
        config: {
          host: 'localhost',
          port,
          model: 'lmstudio-community/Qwen3-VL-2B-Thinking-MLX-8bit',
          max_tokens: 32768,
          temperature: 1.0,
          top_p: 0.95,
          top_k: 20,
          repetition_penalty: 1.0,
          presence_penalty: 1.5,
          greedy: false,
          out_seq_length: 32768,
        },
        healthy: false, // Start as unhealthy, health check will validate
        lastUsed: Date.now(),
        requestCount: 0,
        responseTime: 0,
      };

      this.instances.push(instance);
    }

    // Perform initial health check
    await this.performHealthCheck();

    const healthyCount = this.instances.filter(i => i.healthy).length;

    if (healthyCount === 0) {
      logger.warn(chalk.yellow('⚠️  No MLX instances are currently available'));
      logger.warn(chalk.yellow('Tools requiring MLX backend will be disabled'));
      logger.warn(chalk.yellow('Please start MLX instances on ports 8107-8133'));
    } else if (healthyCount < this.instances.length) {
      logger.warn(chalk.yellow(`⚠️  Only ${healthyCount}/${this.instances.length} MLX instances available`));
    } else {
      logger.info(chalk.green(`✅ All ${this.instances.length} MLX instances healthy`));
    }

    // Start health monitoring
    this.startHealthMonitoring();
  }

  async generateCompletion(
    prompt: string,
    options: Partial<MLXServerConfig> = {}
  ): Promise<string> {
    return this.queue.add(async () => {
      const instance = this.selectBestInstance();

      if (!instance) {
        const msg = 'No healthy MLX instances available. Please ensure MLX servers are running on ports 8107-8133.';
        logger.error(msg);
        throw new Error(msg);
      }

      const startTime = Date.now();
      
      try {
        const response = await axios.post(
          `http://${instance.config.host}:${instance.config.port}/v1/completions`,
          {
            model: instance.config.model,
            prompt,
            max_tokens: options.max_tokens || instance.config.max_tokens,
            temperature: options.temperature || instance.config.temperature,
            top_p: options.top_p || instance.config.top_p,
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
        
        // Update instance metrics
        instance.lastUsed = Date.now();
        instance.requestCount++;
        instance.responseTime = responseTime;
        
        logger.debug(
          `MLX instance ${instance.id} completed in ${chalk.cyan(responseTime + 'ms')}`
        );
        
        return response.data.choices[0]?.text || '';
        
      } catch (error) {
        logger.error(`MLX instance ${instance.id} failed:`, error);
        instance.healthy = false;
        throw error;
      }
    });
  }

  async generateChatCompletion(
    messages: Array<{ role: string; content: string }>,
    options: Partial<MLXServerConfig> = {}
  ): Promise<string> {
    return this.queue.add(async () => {
      const instance = this.selectBestInstance();

      if (!instance) {
        const msg = 'No healthy MLX instances available. Please ensure MLX servers are running on ports 8107-8133.';
        logger.error(msg);
        throw new Error(msg);
      }

      const startTime = Date.now();
      
      try {
        const response = await axios.post(
          `http://${instance.config.host}:${instance.config.port}/v1/chat/completions`,
          {
            model: instance.config.model,
            messages,
            max_tokens: options.max_tokens || instance.config.max_tokens,
            temperature: options.temperature || instance.config.temperature,
            top_p: options.top_p || instance.config.top_p,
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
        
        // Update instance metrics
        instance.lastUsed = Date.now();
        instance.requestCount++;
        instance.responseTime = responseTime;
        
        logger.debug(
          `MLX instance ${instance.id} chat completed in ${chalk.cyan(responseTime + 'ms')}`
        );
        
        return response.data.choices[0]?.message?.content || '';
        
      } catch (error) {
        logger.error(`MLX instance ${instance.id} chat failed:`, error);
        instance.healthy = false;
        throw error;
      }
    });
  }

  private selectBestInstance(): MLXInstance | null {
    const healthyInstances = this.instances.filter(instance => instance.healthy);
    
    if (healthyInstances.length === 0) {
      return null;
    }

    // Select instance with lowest request count and fastest response time
    return healthyInstances.reduce((best, current) => {
      const currentScore = current.requestCount * 0.5 + current.responseTime * 0.5;
      const bestScore = best.requestCount * 0.5 + best.responseTime * 0.5;
      
      return currentScore < bestScore ? current : best;
    });
  }

  private async performHealthCheck(): Promise<void> {
    const healthChecks = this.instances.map(async (instance) => {
      try {
        const response = await axios.get(
          `http://${instance.config.host}:${instance.config.port}/health`,
          { timeout: 600000 }
        );

        if (response.status === 200) {
          instance.healthy = true;
        } else {
          instance.healthy = false;
        }
      } catch (error) {
        instance.healthy = false;
        logger.debug(`MLX instance ${instance.id} on port ${instance.config.port} not available`);
      }
    });

    await Promise.all(healthChecks);
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();

      const healthyCount = this.instances.filter(i => i.healthy).length;
      logger.debug(`Health check: ${healthyCount}/${this.instances.length} instances healthy`);

    }, 600000); // Check every 600 seconds
  }

  isAvailable(): boolean {
    return this.instances.filter(i => i.healthy).length > 0;
  }

  getMetrics() {
    const healthyInstances = this.instances.filter(i => i.healthy).length;
    const totalRequests = this.instances.reduce((sum, i) => sum + i.requestCount, 0);
    const avgResponseTime = this.instances.reduce((sum, i) => sum + i.responseTime, 0) / this.instances.length;

    return {
      healthyInstances,
      totalInstances: this.instances.length,
      totalRequests,
      avgResponseTime,
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