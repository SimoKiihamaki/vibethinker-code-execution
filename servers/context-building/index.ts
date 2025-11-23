import { buildDocumentation } from './buildDocumentation.js';
import { gatherContext } from './gatherContext.js';
import { summarizeModule } from './summarizeModule.js';

// context-building tools for progressive disclosure
export {
  buildDocumentation,
  gatherContext,
  summarizeModule,
};

// Category metadata
export const category = {
  name: 'context-building',
  description: 'Tools for context building',
  tools: ['buildDocumentation', 'gatherContext', 'summarizeModule'],
  complexity: 'complex',
};
