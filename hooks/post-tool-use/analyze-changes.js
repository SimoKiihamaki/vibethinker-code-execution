#!/usr/bin/env node

/**
 * Analyze Changes Hook for PostToolUse
 * Analyzes the impact of changes after tool execution
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Main hook function that analyzes changes
 */
async function main() {
  try {
    // Read input from stdin
    const input = JSON.parse(await readStdin());
    
    console.error('📊 PostToolUse Analyze Changes - Evaluating impact...');
    
    // Extract tool information
    const { tool_name, tool_input, tool_response } = input;
    
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
    
    console.error(`📁 Analyzing changes to: ${filePath}`);
    
    // Analyze the changes
    const analysis = await analyzeChanges(filePath, tool_input, tool_response);
    
    // Generate impact report
    const impact = await generateImpactReport(filePath, analysis);
    
    // Check for potential issues
    const issues = await checkForIssues(filePath, analysis);
    
    // Save analysis results
    await saveAnalysisToCache(filePath, { analysis, impact, issues });
    
    // Print analysis summary
    console.error(`✅ Change analysis completed`);
    console.error(`   Impact level: ${impact.level}`);
    console.error(`   Files affected: ${impact.affectedFiles.length}`);
    console.error(`   Potential issues: ${issues.length}`);
    
    if (issues.length > 0) {
      console.error(`⚠️  Issues detected: ${issues.map(i => i.type).join(', ')}`);
    }
    
    // Output analysis results
    const output = {
      analysis: {
        impactLevel: impact.level,
        affectedFiles: impact.affectedFiles,
        issues: issues,
        recommendations: generateRecommendations(analysis, issues)
      },
      metadata: {
        analyzedAt: new Date().toISOString(),
        filePath: filePath,
        toolName: tool_name
      }
    };
    
    console.log(JSON.stringify(output));
    
  } catch (error) {
    console.error(`❌ Change analysis error: ${error.message}`);
    // Don't fail the tool - just provide empty analysis
    console.log(JSON.stringify({ analysis: {}, metadata: { error: error.message } }));
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
    return toolInput.file_path || toolInput.filePath || toolInput.path || null;
  }
  
  return null;
}

/**
 * Analyze changes made to the file
 */
async function analyzeChanges(filePath, toolInput, toolResponse) {
  const analysis = {
    filePath,
    changeType: '',
    content: '',
    oldContent: '',
    diff: '',
    complexity: 'unknown',
    dependencies: [],
    testFiles: [],
    configFiles: [],
    documentationFiles: []
  };
  
  try {
    // Determine change type
    if (toolInput.old_string && toolInput.new_string) {
      analysis.changeType = 'edit';
      analysis.oldContent = toolInput.old_string;
      analysis.content = toolInput.new_string;
      analysis.diff = generateDiff(toolInput.old_string, toolInput.new_string);
    } else if (toolInput.content) {
      analysis.changeType = 'write';
      analysis.content = toolInput.content;
    } else {
      analysis.changeType = 'unknown';
    }
    
    // Analyze new content complexity
    analysis.complexity = analyzeComplexity(analysis.content);
    
    // Extract dependencies from new content
    analysis.dependencies = extractDependencies(analysis.content, path.extname(filePath));
    
    // Find related files
    const relatedFiles = await findRelatedFiles(filePath, analysis.dependencies);
    analysis.testFiles = relatedFiles.filter(f => f.includes('test') || f.includes('spec'));
    analysis.configFiles = relatedFiles.filter(f => f.includes('config') || f.includes('setup'));
    analysis.documentationFiles = relatedFiles.filter(f => f.endsWith('.md') || f.endsWith('.txt'));
    
    // Check for breaking changes
    analysis.breakingChanges = detectBreakingChanges(analysis.oldContent, analysis.content, path.extname(filePath));
    
    // Analyze API changes
    analysis.apiChanges = detectAPIChanges(analysis.oldContent, analysis.content, path.extname(filePath));
    
  } catch (error) {
    console.error(`Error analyzing changes: ${error.message}`);
  }
  
  return analysis;
}

/**
 * Generate diff between old and new content
 */
function generateDiff(oldContent, newContent) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  // Simple line-by-line diff
  const diff = [];
  const maxLines = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    
    if (oldLine !== newLine) {
      if (oldLine && newLine) {
        diff.push(`- ${oldLine}`);
        diff.push(`+ ${newLine}`);
      } else if (oldLine) {
        diff.push(`- ${oldLine}`);
      } else if (newLine) {
        diff.push(`+ ${newLine}`);
      }
    }
  }
  
  return diff.join('\n');
}

/**
 * Analyze content complexity
 */
function analyzeComplexity(content) {
  const lines = content.split('\n').length;
  
  if (lines < 50) return 'simple';
  if (lines < 200) return 'moderate';
  if (lines < 500) return 'complex';
  return 'very-complex';
}

/**
 * Extract dependencies from content
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
 * Find related files
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
    const gitLog = execSync(`git log --oneline -5 -- "${filePath}"`, { encoding: 'utf8', cwd: process.cwd() });
    
    if (gitLog) {
      changes.push(...gitLog.trim().split('\n').map(line => ({
        type: 'git-commit',
        description: line,
        timestamp: new Date().toISOString()
      })));
    }
    
    // Check git status
    const gitStatus = execSync(`git status --porcelain -- "${filePath}"`, { encoding: 'utf8', cwd: process.cwd() });
    
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
 * Detect breaking changes
 */
function detectBreakingChanges(oldContent, newContent, fileType) {
  const breakingChanges = [];
  
  if (!oldContent || !newContent) return breakingChanges;
  
  switch (fileType) {
    case '.js':
    case '.ts':
    case '.jsx':
    case '.tsx':
      // Check for removed exports
      const oldExports = extractExports(oldContent);
      const newExports = extractExports(newContent);
      
      for (const exp of oldExports) {
        if (!newExports.includes(exp)) {
          breakingChanges.push({
            type: 'removed-export',
            name: exp,
            severity: 'high'
          });
        }
      }
      
      // Check for changed function signatures
      const oldFunctions = extractFunctions(oldContent);
      const newFunctions = extractFunctions(newContent);
      
      for (const func of oldFunctions) {
        const newFunc = newFunctions.find(f => f.name === func.name);
        if (newFunc && func.params !== newFunc.params) {
          breakingChanges.push({
            type: 'changed-signature',
            name: func.name,
            severity: 'high'
          });
        }
      }
      break;
  }
  
  return breakingChanges;
}

/**
 * Extract exports from JavaScript/TypeScript content
 */
function extractExports(content) {
  const exports = [];
  
  // Extract named exports
  const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  
  // Extract default export
  if (content.includes('export default')) {
    exports.push('default');
  }
  
  return exports;
}

/**
 * Extract functions from JavaScript/TypeScript content
 */
function extractFunctions(content) {
  const functions = [];
  
  // Extract function declarations
  const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)/g;
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    functions.push({
      name: match[1],
      params: match[2]
    });
  }
  
  return functions;
}

/**
 * Detect API changes
 */
function detectAPIChanges(oldContent, newContent, fileType) {
  const apiChanges = [];
  
  if (!oldContent || !newContent) return apiChanges;
  
  // This is a simplified implementation
  // In a real system, you'd have more sophisticated API detection
  
  return apiChanges;
}

/**
 * Generate impact report
 */
async function generateImpactReport(filePath, analysis) {
  const impact = {
    level: 'low',
    affectedFiles: [],
    description: '',
    recommendations: []
  };
  
  // Determine impact level based on various factors
  let impactScore = 0;
  
  // Breaking changes increase impact
  impactScore += analysis.breakingChanges.length * 10;
  
  // Complexity affects impact
  const complexityScores = {
    'simple': 1,
    'moderate': 3,
    'complex': 5,
    'very-complex': 8
  };
  impactScore += complexityScores[analysis.complexity] || 1;
  
  // Dependencies affect impact
  impactScore += analysis.dependencies.length * 2;
  
  // Test files reduce impact (good test coverage)
  impactScore -= analysis.testFiles.length * 1;
  
  // Determine impact level
  if (impactScore >= 20) {
    impact.level = 'high';
  } else if (impactScore >= 10) {
    impact.level = 'medium';
  } else {
    impact.level = 'low';
  }
  
  // Find affected files
  impact.affectedFiles = [
    ...analysis.testFiles,
    ...analysis.configFiles,
    ...analysis.documentationFiles
  ];
  
  // Generate description
  impact.description = generateImpactDescription(analysis, impact);
  
  // Generate recommendations
  impact.recommendations = generateImpactRecommendations(analysis, impact);
  
  return impact;
}

/**
 * Generate impact description
 */
function generateImpactDescription(analysis, impact) {
  const parts = [];
  
  parts.push(`${impact.level.toUpperCase()} impact change to ${analysis.filePath}`);
  
  if (analysis.breakingChanges.length > 0) {
    parts.push(`Contains ${analysis.breakingChanges.length} breaking changes`);
  }
  
  if (analysis.dependencies.length > 0) {
    parts.push(`Affects ${analysis.dependencies.length} dependencies`);
  }
  
  if (analysis.testFiles.length > 0) {
    parts.push(`May require updates to ${analysis.testFiles.length} test files`);
  }
  
  return parts.join('. ');
}

/**
 * Generate impact recommendations
 */
function generateImpactRecommendations(analysis, impact) {
  const recommendations = [];
  
  if (impact.level === 'high') {
    recommendations.push('Consider breaking this change into smaller commits');
    recommendations.push('Ensure comprehensive testing before deployment');
    recommendations.push('Update documentation and notify stakeholders');
  }
  
  if (analysis.breakingChanges.length > 0) {
    recommendations.push('Update API documentation for breaking changes');
    recommendations.push('Consider deprecation warnings before removing functionality');
  }
  
  if (analysis.testFiles.length === 0) {
    recommendations.push('Add tests for the modified functionality');
  }
  
  if (analysis.configFiles.length > 0) {
    recommendations.push('Review configuration changes for production impact');
  }
  
  if (analysis.documentationFiles.length === 0) {
    recommendations.push('Update documentation to reflect changes');
  }
  
  return recommendations;
}

/**
 * Check for potential issues
 */
async function checkForIssues(filePath, analysis) {
  const issues = [];
  
  // Check for syntax errors
  const syntaxIssues = await checkSyntaxErrors(filePath, analysis.content);
  issues.push(...syntaxIssues);
  
  // Check for security issues
  const securityIssues = checkSecurityIssues(analysis.content, path.extname(filePath));
  issues.push(...securityIssues);
  
  // Check for performance issues
  const performanceIssues = checkPerformanceIssues(analysis.content, path.extname(filePath));
  issues.push(...performanceIssues);
  
  // Check for maintainability issues
  const maintainabilityIssues = checkMaintainabilityIssues(analysis.content, analysis.complexity);
  issues.push(...maintainabilityIssues);
  
  return issues;
}

/**
 * Check for syntax errors
 */
async function checkSyntaxErrors(filePath, content) {
  const issues = [];
  const ext = path.extname(filePath);
  
  try {
    switch (ext) {
      case '.js':
      case '.jsx':
        // Basic JavaScript syntax check
        try {
          new Function(content);
        } catch (error) {
          issues.push({
            type: 'syntax-error',
            severity: 'high',
            message: `JavaScript syntax error: ${error.message}`
          });
        }
        break;
        
      case '.ts':
      case '.tsx':
        // TypeScript syntax would require TypeScript compiler
        // For now, just check basic JavaScript syntax
        try {
          // Remove TypeScript-specific syntax for basic check
          const jsContent = content
            .replace(/:\s*\w+(\[\])?/g, '') // Remove type annotations
            .replace(/interface\s+\w+\s*{[^}]+}/g, '') // Remove interfaces
            .replace(/type\s+\w+\s*=\s*[^;]+;/g, ''); // Remove type aliases
          
          new Function(jsContent);
        } catch (error) {
          issues.push({
            type: 'syntax-error',
            severity: 'high',
            message: `Potential TypeScript syntax error: ${error.message}`
          });
        }
        break;
        
      case '.json':
        try {
          JSON.parse(content);
        } catch (error) {
          issues.push({
            type: 'syntax-error',
            severity: 'high',
            message: `JSON syntax error: ${error.message}`
          });
        }
        break;
        
      case '.py':
        // Python syntax check would require Python interpreter
        issues.push({
          type: 'syntax-check',
          severity: 'medium',
          message: 'Python syntax validation requires manual review'
        });
        break;
    }
  } catch (error) {
    console.error(`Error checking syntax: ${error.message}`);
  }
  
  return issues;
}

/**
 * Check for security issues
 */
function checkSecurityIssues(content, fileType) {
  const issues = [];
  
  // Common security anti-patterns
  const securityPatterns = [
    {
      pattern: /eval\s*\(/g,
      type: 'code-injection',
      severity: 'high',
      message: 'Use of eval() can lead to code injection vulnerabilities'
    },
    {
      pattern: /innerHTML\s*=\s*[^;]+/g,
      type: 'xss',
      severity: 'high',
      message: 'Direct innerHTML assignment can lead to XSS vulnerabilities'
    },
    {
      pattern: /document\.write\s*\(/g,
      type: 'xss',
      severity: 'high',
      message: 'document.write() can lead to XSS vulnerabilities'
    },
    {
      pattern: /password\s*=\s*['"][^'"]+['"]/g,
      type: 'hardcoded-secret',
      severity: 'high',
      message: 'Hardcoded password detected'
    },
    {
      pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi,
      type: 'hardcoded-secret',
      severity: 'high',
      message: 'Hardcoded API key detected'
    },
    {
      pattern: /\/\*.*?(TODO|FIXME|HACK).*?\*\//gi,
      type: 'security-todo',
      severity: 'medium',
      message: 'Security-related TODO/FIXME comment detected'
    }
  ];
  
  for (const securityPattern of securityPatterns) {
    const matches = content.match(securityPattern.pattern);
    if (matches) {
      issues.push({
        type: securityPattern.type,
        severity: securityPattern.severity,
        message: securityPattern.message,
        count: matches.length
      });
    }
  }
  
  return issues;
}

/**
 * Check for performance issues
 */
function checkPerformanceIssues(content, fileType) {
  const issues = [];
  
  // Performance anti-patterns
  const performancePatterns = [
    {
      pattern: /for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)/g,
      type: 'nested-loops',
      severity: 'medium',
      message: 'Nested loops detected - potential performance issue'
    },
    {
      pattern: /while\s*\(true\)/g,
      type: 'infinite-loop',
      severity: 'high',
      message: 'Potential infinite loop detected'
    },
    {
      pattern: /setInterval\s*\(/g,
      type: 'memory-leak',
      severity: 'medium',
      message: 'setInterval() without clearInterval() can cause memory leaks'
    },
    {
      pattern: /new\s+Array\s*\(\s*\d+\s*\)/g,
      type: 'large-array',
      severity: 'low',
      message: 'Large array allocation detected'
    }
  ];
  
  for (const perfPattern of performancePatterns) {
    const matches = content.match(perfPattern.pattern);
    if (matches) {
      issues.push({
        type: perfPattern.type,
        severity: perfPattern.severity,
        message: perfPattern.message,
        count: matches.length
      });
    }
  }
  
  return issues;
}

/**
 * Check for maintainability issues
 */
function checkMaintainabilityIssues(content, complexity) {
  const issues = [];
  
  // Check for long functions
  const functionRegex = /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n\}/g;
  const functions = content.match(functionRegex) || [];
  
  for (const func of functions) {
    const lines = func.split('\n').length;
    if (lines > 50) {
      issues.push({
        type: 'long-function',
        severity: 'medium',
        message: `Function with ${lines} lines - consider breaking it down`,
        lines: lines
      });
    }
  }
  
  // Check for high complexity
  if (complexity === 'very-complex') {
    issues.push({
      type: 'high-complexity',
      severity: 'medium',
      message: 'File has very high complexity - consider refactoring'
    });
  }
  
  // Check for TODO comments
  const todoRegex = /\/\/.*TODO|#.*TODO|\/\*.*TODO.*\*\//gi;
  const todos = content.match(todoRegex) || [];
  
  if (todos.length > 5) {
    issues.push({
      type: 'many-todos',
      severity: 'low',
      message: `File contains ${todos.length} TODO comments - consider addressing them`,
      count: todos.length
    });
  }
  
  return issues;
}

/**
 * Generate recommendations based on analysis and issues
 */
function generateRecommendations(analysis, issues) {
  const recommendations = [];
  
  // High-severity issues
  const highSeverityIssues = issues.filter(i => i.severity === 'high');
  if (highSeverityIssues.length > 0) {
    recommendations.push('Address high-severity issues before deployment');
    recommendations.push('Consider code review for security-sensitive changes');
  }
  
  // Breaking changes
  if (analysis.breakingChanges && analysis.breakingChanges.length > 0) {
    recommendations.push('Update API documentation for breaking changes');
    recommendations.push('Consider deprecation warnings before removing functionality');
  }
  
  // Test coverage
  if (analysis.testFiles && analysis.testFiles.length === 0) {
    recommendations.push('Add tests for the modified functionality');
  }
  
  // Performance issues
  const performanceIssues = issues.filter(i => i.type.includes('performance') || i.type.includes('memory'));
  if (performanceIssues.length > 0) {
    recommendations.push('Review performance implications of the changes');
  }
  
  // Documentation
  if (analysis.documentationFiles && analysis.documentationFiles.length === 0) {
    recommendations.push('Update documentation to reflect changes');
  }
  
  return recommendations;
}

/**
 * Save analysis to cache
 */
async function saveAnalysisToCache(filePath, analysis) {
  try {
    const cacheDir = path.join(process.cwd(), '.claude', 'analysis');
    await fs.mkdir(cacheDir, { recursive: true });
    
    const cacheFile = path.join(cacheDir, `${path.basename(filePath)}-${Date.now()}.json`);
    const cacheData = {
      filePath,
      analysis,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600000).toISOString() // 24 hours
    };
    
    await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    
  } catch (error) {
    console.error(`Error saving analysis cache: ${error.message}`);
  }
}

// Run the hook
main().catch(error => {
  console.error(`Hook failed: ${error.message}`);
  process.exit(1);
});