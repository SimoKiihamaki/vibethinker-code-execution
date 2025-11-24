import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeFunction } from './analyzeFunction.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('analyzeFunction', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully analyze function', async () => {
        const mockResponse = JSON.stringify({
            complexity: 5,
            issues: ['Long method'],
            suggestions: ['Extract method']
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await analyzeFunction({
            functionName: 'processData',
            filePath: '/src/processor.ts',
            depth: 'detailed'
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(analyzeFunction({
            functionName: 123 as any,
            filePath: '/src/processor.ts'
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await analyzeFunction({
            functionName: 'processData',
            filePath: '/src/processor.ts'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
