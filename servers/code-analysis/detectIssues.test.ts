import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectIssues } from './detectIssues.js';
import { getMLXClient } from '../shared/utils.js';

vi.mock('../shared/utils.js');

describe('detectIssues', () => {
    const mockMLXClient = {
        generateCompletion: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getMLXClient).mockResolvedValue(mockMLXClient as any);
    });

    it('should successfully detect issues', async () => {
        const mockResponse = JSON.stringify({
            issues: [
                { type: 'bug', severity: 'high', description: 'Potential null pointer' }
            ]
        });

        mockMLXClient.generateCompletion.mockResolvedValue(mockResponse);

        const result = await detectIssues({
            target: '/src/unsafe.ts',
            issueTypes: ['bugs', 'security']
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(JSON.parse(mockResponse));
        expect(mockMLXClient.generateCompletion).toHaveBeenCalled();
    });

    it('should handle invalid input', async () => {
        await expect(detectIssues({
            target: 123 as any
        })).rejects.toThrow();
    });

    it('should handle MLX client errors', async () => {
        mockMLXClient.generateCompletion.mockRejectedValue(new Error('MLX Error'));

        const result = await detectIssues({
            target: '/src/unsafe.ts'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('MLX Error');
    });
});
