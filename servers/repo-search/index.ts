import { analyzeImports } from './analyzeImports.js';
import { buildGraph } from './buildGraph.js';
import { findDependencies } from './findDependencies.js';
import { searchByQuery } from './searchByQuery.js';

// repo-search tools for progressive disclosure
export {
  analyzeImports,
  buildGraph,
  findDependencies,
  searchByQuery,
};

// Category metadata
export const category = {
  name: 'repo-search',
  description: 'Tools for repo search',
  tools: ['analyzeImports', 'buildGraph', 'findDependencies', 'searchByQuery'],
  complexity: 'complex',
};
