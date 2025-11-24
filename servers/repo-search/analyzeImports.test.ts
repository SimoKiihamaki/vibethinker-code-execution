import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeImports } from './analyzeImports.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('analyzeImports', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully analyze imports', async () => {
        const mockResponse = JSON.stringify({
            unused: ['lodash'],
            circular: []
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await analyzeImports({
            directory: '/src',
            detectCycles: true
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(analyzeImports({
            directory: 123 as any
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await analyzeImports({
            directory: '/src'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
