

/**
 * Estimate token count for text
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}
