import { describe, it, expect, vi, beforeEach } from 'vitest';
import { synthesizeFindings } from './synthesizeFindings.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('synthesizeFindings', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully synthesize findings', async () => {
        const mockResponse = JSON.stringify({
            summary: 'Codebase is well structured but has some high coupling.',
            recommendations: ['Refactor module X', 'Decouple service Y']
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await synthesizeFindings({
            findings: [
                { type: 'issue', severity: 'high', detail: 'Circular dependency detected' }
            ],
            topic: 'Architecture Health',
            depth: 'detailed',
            includeRecommendations: true
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(synthesizeFindings({
            findings: 'invalid' as any,
            topic: 'Architecture Health',
            depth: 'detailed',
            includeRecommendations: true
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await synthesizeFindings({
            findings: [],
            topic: 'Architecture Health',
            depth: 'detailed',
            includeRecommendations: true
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
