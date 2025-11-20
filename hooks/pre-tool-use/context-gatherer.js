#!/usr/bin/env node

/**
 * Context Gatherer Hook for PreToolUse
 * Automatically gathers context before file edits and operations
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

/**
 * Main hook function that processes the tool use request
 */
async function main() {
  try {
    // Read input from stdin
    const input = JSON.parse(await readStdin());
    
    console.error('🔍 PreToolUse Context Gatherer - Analyzing request...');
    
    // Extract tool information
    const { tool_name, tool_input } = input;
    
    // Only process Write and Edit operations
    if (!['Write', 'Edit'].includes(tool_name)) {
      process.exit(0);
    }
    
    // Extract file path from tool input
    const filePath = extractFilePath(tool_input);
    if (!filePath) {
      console.error('⚠️  Could not extract file path from tool input');
      process.exit(0);
    }
    
    console.error(`📁 Analyzing file: ${filePath}`);
    
    // Gather comprehensive context
    const context = await gatherContext(filePath);
    
    // Save context to cache
    await saveContextToCache(filePath, context);
    
    // Print context summary
    console.error(`✅ Context gathered: ${context.summary}`);
    console.error(`   Dependencies: ${context.dependencies.length}`);
    console.error(`   Related files: ${context.relatedFiles.length}`);
    console.error(`   Recent changes: ${context.recentChanges.length}`);
    
    // Output context for the tool
    const output = {
      context: {
        fileDependencies: context.dependencies,
        relatedFiles: context.relatedFiles,
        recentChanges: context.recentChanges,
        fileType: context.fileType,
        complexity: context.complexity,
        suggestions: context.suggestions
      },
      metadata: {
        gatheredAt: new Date().toISOString(),
        filePath: filePath
      }
    };
    
    console.log(JSON.stringify(output));
    
  } catch (error) {
    console.error(`❌ Context gatherer error: ${error.message}`);
    // Don't fail the tool - just provide empty context
    console.log(JSON.stringify({ context: {}, metadata: { error: error.message } }));
  }
}

/**
 * Read input from stdin
 */
async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    
    process.stdin.on('end', () => {
      resolve(data);
    });
    
    process.stdin.on('error', reject);
  });
}

/**
 * Extract file path from tool input
 */
function extractFilePath(toolInput) {
  if (typeof toolInput === 'string') {
    // Try to extract path from string
    const pathMatch = toolInput.match(/["']([^"']+\.(?:js|ts|jsx|tsx|py|java|cpp|c|h|hpp|md|json|yaml|yml))["']/);
    return pathMatch ? pathMatch[1] : null;
  }
  
  if (typeof toolInput === 'object') {
    // Handle different tool input formats
    return toolInput.file_path || toolInput.filePath || toolInput.path || null;
  }
  
  return null;
}

/**
 * Gather comprehensive context about a file
 */
async function gatherContext(filePath) {
  const context = {
    summary: '',
    dependencies: [],
    relatedFiles: [],
    recentChanges: [],
    fileType: '',
    complexity: 'unknown',
    suggestions: []
  };
  
  try {
    // Determine file type
    context.fileType = path.extname(filePath).toLowerCase();
    
    // Check if file exists
    const fileExists = await fileExistsAsync(filePath);
    
    if (fileExists) {
      // Analyze existing file
      const fileContent = await fs.readFile(filePath, 'utf8');
      context.summary = generateFileSummary(fileContent, context.fileType);
      context.complexity = analyzeComplexity(fileContent, context.fileType);
      context.dependencies = extractDependencies(fileContent, context.fileType);
      
      // Find related files
      context.relatedFiles = await findRelatedFiles(filePath, context.dependencies);
      
      // Get recent changes
      context.recentChanges = await getRecentChanges(filePath);
      
      // Generate suggestions
      context.suggestions = generateSuggestions(filePath, context.fileType, context.complexity);
    } else {
      // New file being created
      context.summary = `New ${context.fileType} file being created`;
      context.complexity = 'new';
      context.suggestions = [`Consider the impact of creating this new ${context.fileType} file`];
    }
    
    // Check for potential issues
    const issues = await checkPotentialIssues(filePath, context);
    if (issues.length > 0) {
      context.suggestions.push(...issues);
    }
    
  } catch (error) {
    console.error(`Error gathering context for ${filePath}: ${error.message}`);
    context.summary = `Error analyzing file: ${error.message}`;
  }
  
  return context;
}

/**
 * Check if file exists
 */
async function fileExistsAsync(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate file summary based on content and type
 */
function generateFileSummary(content, fileType) {
  const lines = content.split('\n').length;
  const size = content.length;
  
  let summary = `${fileType.toUpperCase()} file (${lines} lines, ${(size / 1024).toFixed(1)}KB)`;
  
  // Add type-specific summary
  switch (fileType) {
    case '.js':
    case '.ts':
    case '.jsx':
    case '.tsx':
      const imports = (content.match(/import\s+/g) || []).length;
      const exports = (content.match(/export\s+/g) || []).length;
      const functions = (content.match(/function\s+\w+|const\s+\w+\s*=.*=>/g) || []).length;
      summary += ` - ${imports} imports, ${exports} exports, ~${functions} functions`;
      break;
      
    case '.py':
      const pyImports = (content.match(/^import\s+|^from\s+\w+\s+import/g) || []).length;
      const pyFunctions = (content.match(/^def\s+\w+/g) || []).length;
      const pyClasses = (content.match(/^class\s+\w+/g) || []).length;
      summary += ` - ${pyImports} imports, ${pyFunctions} functions, ${pyClasses} classes`;
      break;
      
    case '.json':
      try {
        const parsed = JSON.parse(content);
        const keys = Object.keys(parsed).length;
        summary += ` - ${keys} top-level keys`;
      } catch {
        summary += ' - Invalid JSON format';
      }
      break;
      
    case '.md':
      const headings = (content.match(/^#+\s+/gm) || []).length;
      summary += ` - ${headings} headings`;
      break;
  }
  
  return summary;
}

/**
 * Analyze file complexity
 */
function analyzeComplexity(content, fileType) {
  const lines = content.split('\n').length;
  
  if (lines < 50) return 'simple';
  if (lines < 200) return 'moderate';
  if (lines < 500) return 'complex';
  return 'very-complex';
}

/**
 * Extract dependencies from file content
 */
function extractDependencies(content, fileType) {
  const dependencies = [];
  
  switch (fileType) {
    case '.js':
    case '.ts':
    case '.jsx':
    case '.tsx':
      // Extract import statements
      const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
      
      // Extract require statements
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
      break;
      
    case '.py':
      // Extract Python imports
      const pyImportRegex = /^(?:import|from)\s+(\w+)/gm;
      while ((match = pyImportRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
      break;
  }
  
  return [...new Set(dependencies)]; // Remove duplicates
}

/**
 * Find related files based on dependencies and patterns
 */
async function findRelatedFiles(filePath, dependencies) {
  const relatedFiles = [];
  const fileDir = path.dirname(filePath);
  const fileName = path.basename(filePath, path.extname(filePath));
  
  try {
    // Find files with similar names
    const dirContents = await fs.readdir(fileDir);
    
    for (const item of dirContents) {
      if (item === path.basename(filePath)) continue;
      
      const itemName = path.basename(item, path.extname(item));
      
      // Check for related naming patterns
      if (itemName.includes(fileName) || fileName.includes(itemName)) {
        relatedFiles.push(path.join(fileDir, item));
      }
      
      // Check for test files
      if (itemName.includes('test') && itemName.includes(fileName)) {
        relatedFiles.push(path.join(fileDir, item));
      }
      
      // Check for config files
      if (item.includes('config') || item.includes('setup')) {
        relatedFiles.push(path.join(fileDir, item));
      }
    }
    
    // Find files that import this file
    const importPattern = new RegExp(`from\\s+['"][./]*${fileName}['"]|require\\s*\\(['"][./]*${fileName}['"]\\)`, 'g');
    
    // This is a simplified check - in a real implementation, you'd search the entire codebase
    for (const dep of dependencies) {
      if (dep.startsWith('./') || dep.startsWith('../')) {
        const depPath = path.resolve(fileDir, dep);
        relatedFiles.push(depPath);
      }
    }
    
  } catch (error) {
    console.error(`Error finding related files: ${error.message}`);
  }
  
  return [...new Set(relatedFiles)];
}

/**
 * Get recent changes to the file
 */
async function getRecentChanges(filePath) {
  const changes = [];
  
  try {
    // Use git to get recent changes
    const gitLog = execFileSync('git', ['log', '--oneline', '-5', '--', filePath], { encoding: 'utf8', cwd: process.cwd() });
    
    if (gitLog) {
      changes.push(...gitLog.trim().split('\n').map(line => ({
        type: 'git-commit',
        description: line,
        timestamp: new Date().toISOString()
      })));
    }
    
    // Check git status
    const gitStatus = execFileSync('git', ['status', '--porcelain', '--', filePath], { encoding: 'utf8', cwd: process.cwd() });
    
    if (gitStatus) {
      changes.push({
        type: 'git-status',
        description: gitStatus.trim(),
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    // Git commands might fail if not in a git repo or file not tracked
    console.error(`Error getting git changes: ${error.message}`);
  }
  
  return changes;
}

/**
 * Generate suggestions based on file analysis
 */
function generateSuggestions(filePath, fileType, complexity) {
  const suggestions = [];
  
  // Complexity-based suggestions
  if (complexity === 'very-complex') {
    suggestions.push('Consider breaking this file into smaller modules');
  }
  
  if (complexity === 'complex') {
    suggestions.push('Consider adding more documentation or comments');
  }
  
  // Type-specific suggestions
  switch (fileType) {
    case '.js':
    case '.ts':
      suggestions.push('Consider adding TypeScript types if not present');
      suggestions.push('Check for proper error handling');
      break;
      
    case '.py':
      suggestions.push('Consider adding docstrings for functions and classes');
      suggestions.push('Check for proper exception handling');
      break;
      
    case '.json':
      suggestions.push('Validate JSON structure and schema');
      break;
      
    case '.md':
      suggestions.push('Check for broken links and formatting');
      break;
  }
  
  return suggestions;
}

/**
 * Check for potential issues
 */
async function checkPotentialIssues(filePath, context) {
  const issues = [];
  
  // Check for common problematic patterns
  if (context.fileType === '.js' || context.fileType === '.ts') {
    // Check for hardcoded values that should be configurable
    if (context.dependencies.some(dep => dep.includes('config') || dep.includes('env'))) {
      issues.push('Ensure configuration values are properly externalized');
    }
    
    // Check for potential security issues
    if (context.dependencies.some(dep => dep.includes('crypto') || dep.includes('auth'))) {
      issues.push('Review security implementations for best practices');
    }
  }
  
  // Check for test files
  const hasTestFile = context.relatedFiles.some(file => 
    file.includes('test') || file.includes('spec')
  );
  
  if (!hasTestFile && !filePath.includes('test') && !filePath.includes('spec')) {
    issues.push('Consider adding tests for this file');
  }
  
  return issues;
}

/**
 * Save context to cache for future use
 */
async function saveContextToCache(filePath, context) {
  try {
    const cacheDir = path.join(process.cwd(), '.claude', 'context');
    await fs.mkdir(cacheDir, { recursive: true });
    
    const cacheFile = path.join(cacheDir, `${path.basename(filePath)}.json`);
    const cacheData = {
      filePath,
      context,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour expiry
    };
    
    await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    
  } catch (error) {
    console.error(`Error saving context cache: ${error.message}`);
  }
}

// Run the hook
main().catch(error => {
  console.error(`Hook failed: ${error.message}`);
  process.exit(1);
});