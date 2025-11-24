import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findDependencies } from './findDependencies.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('findDependencies', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully find dependencies', async () => {
        const mockResponse = JSON.stringify({
            dependencies: ['axios', 'zod']
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await findDependencies({
            filePath: '/src/client.ts',
            depth: 1
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(findDependencies({
            filePath: 123 as any
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await findDependencies({
            filePath: '/src/client.ts'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
