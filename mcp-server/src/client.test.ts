import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MLXClient } from './client.js';
import axios from 'axios';

vi.mock('axios');
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn()
}));

describe('MLXClient', () => {
    let client: MLXClient;

    beforeEach(() => {
        vi.resetAllMocks();
        client = new MLXClient();
    });

    afterEach(async () => {
        await client.shutdown();
    });

    it('should initialize with default config if file not found', async () => {
        // Mock health check
        vi.mocked(axios.get).mockResolvedValue({ status: 200 } as any);

        await client.initialize();
        const metrics = client.getMetrics();
        expect(metrics.totalInstances).toBe(1);
    });

    it('should handle chat completion success', async () => {
        await client.initialize();

        // Mock health check
        vi.mocked(axios.get).mockResolvedValue({ status: 200 } as any);
        // Mock chat completion
        vi.mocked(axios.post).mockResolvedValue({
            data: {
                choices: [{ message: { content: 'Test response' } }]
            }
        } as any);

        // Force healthy state for test
        await (client as any).performHealthCheck();

        const response = await client.generateChatCompletion([
            { role: 'user', content: 'Hello' }
        ]);

        expect(response).toBe('Test response');
        expect(axios.post).toHaveBeenCalledWith(
            expect.stringContaining('/v1/chat/completions'),
            expect.objectContaining({
                messages: [{ role: 'user', content: 'Hello' }]
            }),
            expect.any(Object)
        );
    });

    it('should handle chat completion failure', async () => {
        await client.initialize();

        // Mock health check
        vi.mocked(axios.get).mockResolvedValue({ status: 200 } as any);
        // Mock chat completion failure
        vi.mocked(axios.post).mockRejectedValue(new Error('Network error'));

        // Force healthy state for test
        await (client as any).performHealthCheck();

        await expect(client.generateChatCompletion([
            { role: 'user', content: 'Hello' }
        ])).rejects.toThrow('Network error');
    });

    it('should report unhealthy status when health check fails', async () => {
        await client.initialize();
        vi.mocked(axios.get).mockRejectedValue(new Error('Connection refused'));

        await (client as any).performHealthCheck();
        expect(client.isAvailable()).toBe(false);
    });
});
