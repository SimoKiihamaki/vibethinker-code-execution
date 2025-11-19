import { analyzeFile } from './analyzeFile.js';
import { analyzeFunction } from './analyzeFunction.js';
import { findPatterns } from './findPatterns.js';
import { detectIssues } from './detectIssues.js';

// code-analysis tools for progressive disclosure
export {
  analyzeFile,
  analyzeFunction,
  findPatterns,
  detectIssues,
};

// Category metadata
export const category = {
  name: 'code-analysis',
  description: 'Tools for code analysis',
  tools: ['analyzeFile', 'analyzeFunction', 'findPatterns', 'detectIssues'],
  complexity: 'complex',
};
