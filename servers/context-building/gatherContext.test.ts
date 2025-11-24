import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gatherContext } from './gatherContext.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('gatherContext', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully gather context', async () => {
        const mockResponse = JSON.stringify({
            context: 'Relevant context...'
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await gatherContext({
            target: 'auth',
            contextTypes: ['code', 'documentation']
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(gatherContext({
            target: 123 as any
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await gatherContext({
            target: 'test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
