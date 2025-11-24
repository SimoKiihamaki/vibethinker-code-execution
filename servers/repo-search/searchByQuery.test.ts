import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchByQuery } from './searchByQuery.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('searchByQuery', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully search by query', async () => {
        const mockResponse = JSON.stringify({
            results: [
                { file: '/src/auth.ts', match: 'login function' }
            ]
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await searchByQuery({
            query: 'login logic'
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(searchByQuery({
            query: 123 as any
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await searchByQuery({
            query: 'test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
