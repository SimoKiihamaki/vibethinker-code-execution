import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeModule } from './summarizeModule.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('summarizeModule', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully summarize module', async () => {
        const mockResponse = JSON.stringify({
            summary: 'This module handles user authentication.'
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await summarizeModule({
            modulePath: '/src/auth',
            summaryType: 'brief'
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(summarizeModule({
            modulePath: 123 as any
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await summarizeModule({
            modulePath: '/src/auth'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
