import { z } from 'zod';
import { MLXClient } from '../../client.js';

let cachedClient: MLXClient | null = null;

export async function getMLXClient(): Promise<MLXClient> {
  if (cachedClient) return cachedClient;
  const client = new MLXClient();
  await client.initialize();
  cachedClient = client;
  return client;
}

export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}
