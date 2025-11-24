import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDocumentation } from './buildDocumentation.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('buildDocumentation', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully build documentation', async () => {
        const mockResponse = JSON.stringify({
            documentation: '# Auth Module\n\nHandles login and signup.'
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await buildDocumentation({
            target: '/src/auth',
            docType: 'api'
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(buildDocumentation({
            target: 123 as any
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await buildDocumentation({
            target: '/src/auth'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
