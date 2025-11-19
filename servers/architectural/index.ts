import { synthesizeFindings } from './synthesizeFindings.js';
import { mapArchitecture } from './mapArchitecture.js';
import { identifyPatterns } from './identifyPatterns.js';

// architectural tools for progressive disclosure
export {
  synthesizeFindings,
  mapArchitecture,
  identifyPatterns,
};

// Category metadata
export const category = {
  name: 'architectural',
  description: 'Tools for architectural',
  tools: ['synthesizeFindings', 'mapArchitecture', 'identifyPatterns'],
  complexity: 'complex',
};
