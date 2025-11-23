import { analyzeFile } from './analyzeFile.js';
import { analyzeFunction } from './analyzeFunction.js';
import { detectIssues } from './detectIssues.js';
import { findPatterns } from './findPatterns.js';

// code-analysis tools for progressive disclosure
export {
  analyzeFile,
  analyzeFunction,
  detectIssues,
  findPatterns,
};

// Category metadata
export const category = {
  name: 'code-analysis',
  description: 'Tools for code analysis',
  tools: ['analyzeFile', 'analyzeFunction', 'detectIssues', 'findPatterns'],
  complexity: 'complex',
};
