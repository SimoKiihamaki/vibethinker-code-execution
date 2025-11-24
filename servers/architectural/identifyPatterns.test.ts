import { describe, it, expect, vi, beforeEach } from 'vitest';
import { identifyPatterns } from './identifyPatterns.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('identifyPatterns', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully identify patterns', async () => {
        const mockResponse = JSON.stringify({
            patterns: [
                { name: 'MVC', confidence: 0.9, locations: ['/src/controllers'] },
                { name: 'Repository', confidence: 0.8, locations: ['/src/repos'] }
            ]
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await identifyPatterns({
            codebase: '/src',
            patternTypes: ['architectural-patterns'],
            includeViolations: true
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(identifyPatterns({
            codebase: 123 as any,
            patternTypes: ['architectural-patterns'],
            includeViolations: true
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await identifyPatterns({
            codebase: '/src',
            patternTypes: ['architectural-patterns'],
            includeViolations: true
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
