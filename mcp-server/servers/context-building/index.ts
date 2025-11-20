import { gatherContext } from './gatherContext.js';
import { summarizeModule } from './summarizeModule.js';
import { buildDocumentation } from './buildDocumentation.js';

// context-building tools for progressive disclosure
export {
  gatherContext,
  summarizeModule,
  buildDocumentation,
};

// Category metadata
export const category = {
  name: 'context-building',
  description: 'Tools for context building',
  tools: ['gatherContext', 'summarizeModule', 'buildDocumentation'],
  complexity: 'complex',
};
