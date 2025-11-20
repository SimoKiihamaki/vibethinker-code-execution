import { describe, it, expect } from 'vitest';
import DeepRepoResearch from '../skills/deep-repo-research/index.js';

describe('DeepRepoResearch.assessDocumentationQuality', () => {
  const skill = new DeepRepoResearch({ cacheResults: false });

  it('returns 0 for empty file lists', () => {
    expect(skill.assessDocumentationQuality([])).toBe(0);
  });

  it('scores only README presence modestly', () => {
    const files = [{
      path: 'README.md',
      content: 'A short readme'.repeat(120)
    }];

    const score = skill.assessDocumentationQuality(files);
    expect(score).toBeGreaterThanOrEqual(15);
    expect(score).toBeLessThanOrEqual(25);
  });

  it('scores high when docs, comments, and JSDoc are present', () => {
    const files = [
      { path: 'README.md', content: 'Great docs '.repeat(400) },
      { path: 'docs/guide.md', content: 'Detailed docs '.repeat(1500), size: 15000 },
      { path: 'CHANGELOG.md', content: 'v1.0.0 - initial release' },
      {
        path: 'src/index.js',
        content: `/**
 * Adds two numbers
 * @param {number} a
 * @param {number} b
 */
export function add(a, b) {
  // simple sum
  return a + b;
}
// trailing comment`
      },
      {
        path: 'src/feature.ts',
        content: `// module comment
export const foo = 1;
// another comment line`
      }
    ];

    const score = skill.assessDocumentationQuality(files);
    expect(score).toBeGreaterThanOrEqual(80);
  });
});
