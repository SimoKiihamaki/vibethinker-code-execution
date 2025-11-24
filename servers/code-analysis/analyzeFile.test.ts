import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeFile } from './analyzeFile.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('analyzeFile', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully analyze file', async () => {
        const mockResponse = JSON.stringify({
            complexity: 'low',
            issues: [],
            summary: 'Simple utility file'
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await analyzeFile({
            filePath: '/src/utils.ts',
            analysisType: 'complexity'
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(analyzeFile({
            filePath: 123 as any
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await analyzeFile({
            filePath: '/src/utils.ts'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
