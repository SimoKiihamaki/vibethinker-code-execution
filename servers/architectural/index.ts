import { generateReport } from './generateReport.js';
import { identifyPatterns } from './identifyPatterns.js';
import { mapArchitecture } from './mapArchitecture.js';
import { synthesizeFindings } from './synthesizeFindings.js';

// architectural tools for progressive disclosure
export {
  generateReport,
  identifyPatterns,
  mapArchitecture,
  synthesizeFindings,
};

// Category metadata
export const category = {
  name: 'architectural',
  description: 'Tools for architectural',
  tools: ['generateReport', 'identifyPatterns', 'mapArchitecture', 'synthesizeFindings'],
  complexity: 'complex',
};
