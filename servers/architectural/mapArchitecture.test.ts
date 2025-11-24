import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapArchitecture } from './mapArchitecture.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('mapArchitecture', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully map architecture', async () => {
        const mockResponse = JSON.stringify({
            layers: ['presentation', 'business', 'data'],
            dependencies: { presentation: ['business'] }
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await mapArchitecture({
            rootPath: '/src',
            layers: ['presentation', 'business'],
            includeDependencies: true
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(mapArchitecture({
            rootPath: 123 as any // Invalid type
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await mapArchitecture({
            rootPath: '/src'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });

    it('should handle non-JSON response from MLX', async () => {
        const textResponse = 'Analysis of architecture...';
        mockMLXClient.generateCompletion.mockResolvedValue(textResponse);

        const result = await mapArchitecture({
            rootPath: '/src'
        });

        expect(result.success).toBe(true);
        expect(result.data.result).toBe(textResponse);
    });
});
