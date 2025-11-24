import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateReport } from './generateReport.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('generateReport', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully generate report', async () => {
        const mockResponse = '<html><body><h1>Report</h1></body></html>';

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await generateReport({
            directory: '/src',
            outputFile: 'report.html',
            includeGraphs: true
        });

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
    });

    it('should handle invalid input', async () => {
        await expect(generateReport({
            directory: 123 as any, // Invalid type
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await generateReport({
            directory: '/src'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
