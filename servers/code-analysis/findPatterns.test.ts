import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findPatterns } from './findPatterns.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('findPatterns', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully find patterns', async () => {
        const mockResponse = JSON.stringify({
            matches: [
                { pattern: 'Singleton', line: 10 }
            ]
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await findPatterns({
            directory: '/src',
            patternTypes: ['best-practices']
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(findPatterns({
            directory: 123 as any
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await findPatterns({
            directory: '/src'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
