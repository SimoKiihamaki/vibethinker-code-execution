import { searchByQuery } from './searchByQuery.js';
import { findDependencies } from './findDependencies.js';
import { analyzeImports } from './analyzeImports.js';
import { buildGraph } from './buildGraph.js';

// repo-search tools for progressive disclosure
export {
  searchByQuery,
  findDependencies,
  analyzeImports,
  buildGraph,
};

// Category metadata
export const category = {
  name: 'repo-search',
  description: 'Tools for repo search',
  tools: ['searchByQuery', 'findDependencies', 'analyzeImports', 'buildGraph'],
  complexity: 'complex',
};
