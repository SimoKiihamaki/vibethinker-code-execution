import { describe, it, expect } from 'vitest';
import {
  getSecurityScore,
  getSecurityLevel,
  maxSecurityLevel,
  validateOperation
} from './security-validator.js';

describe('security level helpers', () => {
  it('converts severity labels to numeric scores', () => {
    expect(getSecurityScore('critical')).toBe(4);
    expect(getSecurityScore('medium')).toBe(2);
    expect(getSecurityScore('unknown')).toBe(0);
  });

  it('converts numeric scores back to labels', () => {
    expect(getSecurityLevel(4)).toBe('critical');
    expect(getSecurityLevel(3)).toBe('high');
    expect(getSecurityLevel(1)).toBe('low');
  });

  it('combines severities by comparing numeric scores', () => {
    expect(maxSecurityLevel('low', 'medium')).toBe('medium');
    expect(maxSecurityLevel('medium', 4)).toBe('critical');
  });
});

describe('validateOperation severity aggregation', () => {
  it('preserves the highest severity when multiple warnings trigger', async () => {
    const result = await validateOperation('Write', {
      file_path: './config/security.conf',
      content: 'warn@example.com'
    });

    expect(result.isValid).toBe(true);
    expect(result.securityLevel).toBe('high');
    expect(result.warnings).toContain('Configuration file modification detected');
    expect(result.warnings).toContain('Email address detected');
  });
});
