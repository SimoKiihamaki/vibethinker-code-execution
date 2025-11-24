import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildGraph } from './buildGraph.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('buildGraph', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully build graph', async () => {
        const mockResponse = JSON.stringify({
            nodes: [{ id: 'A' }, { id: 'B' }],
            edges: [{ from: 'A', to: 'B' }]
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await buildGraph({
            rootPath: '/src',
            includeNodeModules: false
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(buildGraph({
            rootPath: 123 as any
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await buildGraph({
            rootPath: '/src'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
