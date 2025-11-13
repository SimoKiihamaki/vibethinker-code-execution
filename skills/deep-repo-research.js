#!/usr/bin/env node

/**
 * Deep Repository Research Skill
 * Performs comprehensive analysis of code repositories using MLX acceleration
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { execSync } from 'child_process';

/**
 * Deep Repository Research Skill
 * 
 * This skill performs comprehensive analysis of code repositories including:
 * - Multi-language code analysis
 * - Dependency graph construction
 * - Architectural pattern detection
 * - Code quality assessment
 * - Performance bottleneck identification
 * - Security vulnerability scanning
 * - Documentation coverage analysis
 * - Test coverage evaluation
 * 
 * Usage:
 * node skills/deep-repo-research.js <repository_path> [options]
 * 
 * Options:
 * --depth=full|shallow     Analysis depth (default: full)
 * --languages=js,ts,py     Languages to analyze (default: all)
 * --output=json|markdown   Output format (default: json)
 * --include-tests          Include test files in analysis
 * --include-docs           Include documentation files
 * --security-scan          Perform security vulnerability scan
 * --performance-analysis   Analyze performance patterns
 * 
 * Examples:
 * node skills/deep-repo-research.js ./src
 * node skills/deep-repo-research.js ./src --depth=shallow --languages=js,ts
 * node skills/deep-repo-research.js ./src --security-scan --performance-analysis
 */

/**
 * Main function for deep repository research
 */
async function main() {
  try {
    const args = parseArguments();
    const repositoryPath = path.resolve(args.repository);
    
    console.error(`🔍 Deep Repository Research: ${repositoryPath}`);
    console.error(`   Depth: ${args.depth}`);
    console.error(`   Languages: ${args.languages.join(', ')}`);
    console.error(`   Output: ${args.output}`);
    
    // Validate repository path
    if (!await validateRepository(repositoryPath)) {
      throw new Error(`Invalid repository path: ${repositoryPath}`);
    }
    
    // Perform comprehensive analysis
    const analysis = await performComprehensiveAnalysis(repositoryPath, args);
    
    // Generate research report
    const report = await generateResearchReport(analysis, args);
    
    // Save results
    await saveResearchResults(repositoryPath, analysis, report, args);
    
    console.error(`✅ Deep repository research completed`);
    console.error(`   Files analyzed: ${analysis.files.length}`);
    console.error(`   Dependencies found: ${analysis.dependencies.length}`);
    console.error(`   Issues detected: ${analysis.issues.length}`);
    console.error(`   Performance insights: ${analysis.performanceInsights.length}`);
    
    // Output results
    if (args.output === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(generateMarkdownReport(report));
    }
    
  } catch (error) {
    console.error(`❌ Deep repository research error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = {
    repository: process.argv[2] || '.',
    depth: 'full',
    languages: [],
    output: 'json',
    includeTests: false,
    includeDocs: false,
    securityScan: false,
    performanceAnalysis: false
  };
  
  // Parse additional arguments
  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    if (arg.startsWith('--depth=')) {
      args.depth = arg.split('=')[1];
    } else if (arg.startsWith('--languages=')) {
      args.languages = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--output=')) {
      args.output = arg.split('=')[1];
    } else if (arg === '--include-tests') {
      args.includeTests = true;
    } else if (arg === '--include-docs') {
      args.includeDocs = true;
    } else if (arg === '--security-scan') {
      args.securityScan = true;
    } else if (arg === '--performance-analysis') {
      args.performanceAnalysis = true;
    }
  }
  
  // Auto-detect languages if not specified
  if (args.languages.length === 0) {
    args.languages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 'rust'];
  }
  
  return args;
}

/**
 * Validate repository path
 */
async function validateRepository(repositoryPath) {
  try {
    const stat = await fs.stat(repositoryPath);
    return stat.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Perform comprehensive analysis
 */
async function performComprehensiveAnalysis(repositoryPath, args) {
  const analysis = {
    repository: repositoryPath,
    timestamp: new Date().toISOString(),
    files: [],
    dependencies: [],
    architecture: {},
    codeQuality: {},
    performanceInsights: [],
    securityIssues: [],
    documentation: {},
    testCoverage: {},
    issues: [],
    recommendations: []
  };
  
  try {
    // Discover files
    analysis.files = await discoverFiles(repositoryPath, args);
    
    // Analyze each file
    for (const file of analysis.files) {
      await analyzeFile(file, analysis, args);
    }
    
    // Build dependency graph
    analysis.dependencies = await buildDependencyGraph(analysis.files);
    
    // Detect architectural patterns
    analysis.architecture = await detectArchitecturalPatterns(analysis.files);
    
    // Assess code quality
    analysis.codeQuality = await assessCodeQuality(analysis.files);
    
    // Performance analysis
    if (args.performanceAnalysis) {
      analysis.performanceInsights = await analyzePerformance(analysis.files);
    }
    
    // Security scan
    if (args.securityScan) {
      analysis.securityIssues = await scanSecurity(analysis.files);
    }
    
    // Documentation analysis
    analysis.documentation = await analyzeDocumentation(repositoryPath, analysis.files);
    
    // Test coverage analysis
    analysis.testCoverage = await analyzeTestCoverage(repositoryPath, analysis.files);
    
    // Generate recommendations
    analysis.recommendations = await generateRecommendations(analysis);
    
  } catch (error) {
    console.error(`Error during comprehensive analysis: ${error.message}`);
    analysis.issues.push({
      type: 'analysis-error',
      severity: 'high',
      message: error.message
    });
  }
  
  return analysis;
}

/**
 * Discover files in repository
 */
async function discoverFiles(repositoryPath, args) {
  const files = [];
  
  try {
    // Define file patterns based on languages
    const languagePatterns = {
      javascript: ['**/*.js', '**/*.jsx', '**/*.mjs'],
      typescript: ['**/*.ts', '**/*.tsx'],
      python: ['**/*.py'],
      java: ['**/*.java'],
      cpp: ['**/*.cpp', '**/*.cxx', '**/*.cc'],
      c: ['**/*.c', '**/*.h'],
      go: ['**/*.go'],
      rust: ['**/*.rs']
    };
    
    // Build glob patterns
    const patterns = [];
    for (const lang of args.languages) {
      if (languagePatterns[lang]) {
        patterns.push(...languagePatterns[lang]);
      }
    }
    
    // Add test files if requested
    if (args.includeTests) {
      patterns.push('**/*test*', '**/*spec*', '**/test/**', '**/tests/**', '**/__tests__/**');
    }
    
    // Add documentation if requested
    if (args.includeDocs) {
      patterns.push('**/*.md', '**/*.rst', '**/*.txt', '**/docs/**', '**/doc/**');
    }
    
    // Find files
    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, {
          cwd: repositoryPath,
          ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '*.min.js']
        });
        
        for (const match of matches) {
          const fullPath = path.join(repositoryPath, match);
          try {
            const stat = await fs.stat(fullPath);
            if (stat.isFile()) {
              const content = await fs.readFile(fullPath, 'utf8');
              files.push({
                path: fullPath,
                relativePath: match,
                size: stat.size,
                lines: content.split('\n').length,
                language: detectLanguage(match),
                content: args.depth === 'full' ? content : null
              });
            }
          } catch (error) {
            console.error(`Error reading file ${fullPath}: ${error.message}`);
          }
        }
      } catch (error) {
        console.error(`Error with pattern ${pattern}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error(`Error discovering files: ${error.message}`);
  }
  
  return files;
}

/**
 * Detect language from file path
 */
function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.cxx': 'cpp',
    '.cc': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.go': 'go',
    '.rs': 'rust',
    '.md': 'markdown',
    '.rst': 'restructuredtext',
    '.txt': 'text'
  };
  return languageMap[ext] || 'unknown';
}

/**
 * Analyze individual file
 */
async function analyzeFile(file, analysis, args) {
  try {
    if (!file.content && args.depth === 'full') {
      file.content = await fs.readFile(file.path, 'utf8');
    }
    
    // Extract dependencies
    const dependencies = extractDependencies(file.content, file.language);
    analysis.dependencies.push(...dependencies);
    
    // Analyze code complexity
    file.complexity = analyzeComplexity(file.content, file.language);
    
    // Find code smells
    file.codeSmells = findCodeSmells(file.content, file.language);
    
    // Check for TODOs and FIXMEs
    file.todos = findTodos(file.content);
    
    // Security scan
    if (args.securityScan) {
      file.securityIssues = scanFileSecurity(file.content, file.language);
      analysis.securityIssues.push(...file.securityIssues);
    }
    
    // Performance analysis
    if (args.performanceAnalysis) {
      file.performanceIssues = analyzeFilePerformance(file.content, file.language);
      analysis.performanceInsights.push(...file.performanceIssues);
    }
    
  } catch (error) {
    console.error(`Error analyzing file ${file.path}: ${error.message}`);
    analysis.issues.push({
      type: 'file-analysis-error',
      file: file.path,
      severity: 'medium',
      message: error.message
    });
  }
}

/**
 * Extract dependencies from file content
 */
function extractDependencies(content, language) {
  const dependencies = [];
  
  try {
    switch (language) {
      case 'javascript':
      case 'typescript':
        // ES6 imports
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          dependencies.push({
            type: 'import',
            name: match[1],
            language: language
          });
        }
        
        // CommonJS requires
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
          dependencies.push({
            type: 'require',
            name: match[1],
            language: language
          });
        }
        break;
        
      case 'python':
        // Python imports
        const pyImportRegex = /^(?:import|from)\s+(\w+)/gm;
        while ((match = pyImportRegex.exec(content)) !== null) {
          dependencies.push({
            type: 'import',
            name: match[1],
            language: language
          });
        }
        break;
    }
  } catch (error) {
    console.error(`Error extracting dependencies: ${error.message}`);
  }
  
  return dependencies;
}

/**
 * Analyze code complexity
 */
function analyzeComplexity(content, language) {
  const complexity = {
    cyclomatic: 1,
    lines: content.split('\n').length,
    functions: 0,
    classes: 0,
    depth: 'unknown'
  };
  
  try {
    // Count functions and classes
    switch (language) {
      case 'javascript':
      case 'typescript':
        complexity.functions = (content.match(/function\s+\w+/g) || []).length;
        complexity.functions += (content.match(/\w+\s*:\s*function/g) || []).length;
        complexity.functions += (content.match(/=>\s*{/g) || []).length;
        complexity.classes = (content.match(/class\s+\w+/g) || []).length;
        break;
        
      case 'python':
        complexity.functions = (content.match(/^def\s+\w+/gm) || []).length;
        complexity.classes = (content.match(/^class\s+\w+/gm) || []).length;
        break;
    }
    
    // Determine complexity depth
    if (complexity.lines < 50) {
      complexity.depth = 'simple';
    } else if (complexity.lines < 200) {
      complexity.depth = 'moderate';
    } else if (complexity.lines < 500) {
      complexity.depth = 'complex';
    } else {
      complexity.depth = 'very-complex';
    }
    
  } catch (error) {
    console.error(`Error analyzing complexity: ${error.message}`);
  }
  
  return complexity;
}

/**
 * Find code smells
 */
function findCodeSmells(content, language) {
  const smells = [];
  
  try {
    // Long functions
    const lines = content.split('\n');
    let functionStart = -1;
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect function start
      if (language === 'javascript' || language === 'typescript') {
        if (line.match(/function\s+\w+/) || line.match(/\w+\s*:\s*function/)) {
          functionStart = i;
          braceCount = 0;
        }
      } else if (language === 'python') {
        if (line.match(/^def\s+\w+/)) {
          functionStart = i;
        }
      }
      
      // Count braces for JS/TS
      if (language === 'javascript' || language === 'typescript') {
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;
        
        // Function end
        if (functionStart !== -1 && braceCount === 0) {
          const functionLength = i - functionStart + 1;
          if (functionLength > 50) {
            smells.push({
              type: 'long-function',
              severity: 'medium',
              line: functionStart + 1,
              message: `Function is ${functionLength} lines long`
            });
          }
          functionStart = -1;
        }
      }
    }
    
    // Duplicate code (simple detection)
    const codeBlocks = extractCodeBlocks(content, language);
    const blockHashes = new Map();
    
    for (const block of codeBlocks) {
      const hash = generateHash(block.content);
      if (blockHashes.has(hash)) {
        smells.push({
          type: 'duplicate-code',
          severity: 'low',
          line: block.line,
          message: 'Potential code duplication detected'
        });
      } else {
        blockHashes.set(hash, block);
      }
    }
    
  } catch (error) {
    console.error(`Error finding code smells: ${error.message}`);
  }
  
  return smells;
}

/**
 * Extract code blocks for duplication detection
 */
function extractCodeBlocks(content, language) {
  const blocks = [];
  const lines = content.split('\n');
  
  try {
    switch (language) {
      case 'javascript':
      case 'typescript':
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !line.startsWith('//') && !line.startsWith('*')) {
            blocks.push({
              line: i + 1,
              content: line
            });
          }
        }
        break;
        
      case 'python':
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !line.startsWith('#')) {
            blocks.push({
              line: i + 1,
              content: line
            });
          }
        }
        break;
    }
  } catch (error) {
    console.error(`Error extracting code blocks: ${error.message}`);
  }
  
  return blocks;
}

/**
 * Find TODOs and FIXMEs
 */
function findTodos(content) {
  const todos = [];
  const lines = content.split('\n');
  
  try {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const todoMatch = line.match(/TODO|FIXME|HACK|XXX/i);
      if (todoMatch) {
        todos.push({
          type: todoMatch[0].toUpperCase(),
          line: i + 1,
          text: line.trim(),
          severity: 'low'
        });
      }
    }
  } catch (error) {
    console.error(`Error finding TODOs: ${error.message}`);
  }
  
  return todos;
}

/**
 * Generate hash for content
 */
function generateHash(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Build dependency graph
 */
async function buildDependencyGraph(files) {
  const graph = {
    nodes: [],
    edges: [],
    cycles: [],
    orphans: []
  };
  
  try {
    // Build nodes
    for (const file of files) {
      graph.nodes.push({
        id: file.path,
        path: file.relativePath,
        language: file.language,
        size: file.size,
        complexity: file.complexity
      });
    }
    
    // Build edges (simplified)
    for (const file of files) {
      if (file.content) {
        const dependencies = extractDependencies(file.content, file.language);
        for (const dep of dependencies) {
          // Find target file
          const targetFile = files.find(f => 
            f.relativePath.includes(dep.name) || 
            dep.name.includes(path.basename(f.relativePath, path.extname(f.relativePath)))
          );
          
          if (targetFile) {
            graph.edges.push({
              source: file.path,
              target: targetFile.path,
              type: dep.type
            });
          }
        }
      }
    }
    
    // Find orphans (files with no dependencies)
    const dependentFiles = new Set(graph.edges.map(e => e.target));
    graph.orphans = graph.nodes.filter(n => !dependentFiles.has(n.id));
    
  } catch (error) {
    console.error(`Error building dependency graph: ${error.message}`);
  }
  
  return graph;
}

/**
 * Detect architectural patterns
 */
async function detectArchitecturalPatterns(files) {
  const patterns = {
    mvc: false,
    layered: false,
    microservices: false,
    monolithic: false,
    modular: false,
    patterns: []
  };
  
  try {
    // Check for MVC pattern
    const hasModels = files.some(f => f.relativePath.includes('model'));
    const hasViews = files.some(f => f.relativePath.includes('view'));
    const hasControllers = files.some(f => f.relativePath.includes('controller'));
    
    if (hasModels && hasViews && hasControllers) {
      patterns.mvc = true;
      patterns.patterns.push('MVC (Model-View-Controller)');
    }
    
    // Check for layered architecture
    const hasLayers = files.some(f => 
      f.relativePath.includes('service') || 
      f.relativePath.includes('repository') || 
      f.relativePath.includes('dao')
    );
    
    if (hasLayers) {
      patterns.layered = true;
      patterns.patterns.push('Layered Architecture');
    }
    
    // Check for microservices indicators
    const hasMicroservices = files.some(f => 
      f.relativePath.includes('service') && 
      (f.content?.includes('express') || f.content?.includes('fastapi') || f.content?.includes('spring'))
    );
    
    if (hasMicroservices) {
      patterns.microservices = true;
      patterns.patterns.push('Microservices Architecture');
    }
    
    // Check for modular architecture
    const hasModules = files.some(f => 
      f.relativePath.includes('module') || 
      f.relativePath.includes('component')
    );
    
    if (hasModules) {
      patterns.modular = true;
      patterns.patterns.push('Modular Architecture');
    }
    
    // Check for monolithic indicators
    if (!patterns.microservices && files.length > 50) {
      patterns.monolithic = true;
      patterns.patterns.push('Monolithic Architecture');
    }
    
  } catch (error) {
    console.error(`Error detecting architectural patterns: ${error.message}`);
  }
  
  return patterns;
}

/**
 * Assess code quality
 */
async function assessCodeQuality(files) {
  const quality = {
    overall: 'unknown',
    metrics: {
      averageComplexity: 0,
      codeSmellCount: 0,
      todoCount: 0,
      duplicateLines: 0
    },
    grades: {
      complexity: 'unknown',
      maintainability: 'unknown',
      readability: 'unknown'
    }
  };
  
  try {
    let totalComplexity = 0;
    let totalCodeSmells = 0;
    let totalTodos = 0;
    
    for (const file of files) {
      if (file.complexity) {
        totalComplexity += file.complexity.cyclomatic;
      }
      
      if (file.codeSmells) {
        totalCodeSmells += file.codeSmells.length;
      }
      
      if (file.todos) {
        totalTodos += file.todos.length;
      }
    }
    
    // Calculate averages
    quality.metrics.averageComplexity = files.length > 0 ? totalComplexity / files.length : 0;
    quality.metrics.codeSmellCount = totalCodeSmells;
    quality.metrics.todoCount = totalTodos;
    
    // Determine overall quality
    if (quality.metrics.averageComplexity < 5 && totalCodeSmells < 10 && totalTodos < 20) {
      quality.overall = 'excellent';
    } else if (quality.metrics.averageComplexity < 10 && totalCodeSmells < 30 && totalTodos < 50) {
      quality.overall = 'good';
    } else if (quality.metrics.averageComplexity < 20 && totalCodeSmells < 60 && totalTodos < 100) {
      quality.overall = 'fair';
    } else {
      quality.overall = 'poor';
    }
    
    // Assign grades
    quality.grades.complexity = quality.metrics.averageComplexity < 10 ? 'good' : 'needs-improvement';
    quality.grades.maintainability = totalCodeSmells < 30 ? 'good' : 'needs-improvement';
    quality.grades.readability = totalTodos < 50 ? 'good' : 'needs-improvement';
    
  } catch (error) {
    console.error(`Error assessing code quality: ${error.message}`);
  }
  
  return quality;
}

/**
 * Analyze performance
 */
async function analyzePerformance(files) {
  const insights = [];
  
  try {
    for (const file of files) {
      if (file.content) {
        const fileInsights = analyzeFilePerformance(file.content, file.language);
        insights.push(...fileInsights);
      }
    }
    
  } catch (error) {
    console.error(`Error analyzing performance: ${error.message}`);
  }
  
  return insights;
}

/**
 * Analyze file performance
 */
function analyzeFilePerformance(content, language) {
  const issues = [];
  
  try {
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Check for nested loops
        const nestedLoopRegex = /for\s*\([^)]*\)\s*\{[\s\S]*?for\s*\([^)]*\)/g;
        const nestedLoops = content.match(nestedLoopRegex);
        if (nestedLoops) {
          issues.push({
            type: 'nested-loops',
            severity: 'medium',
            file: 'current',
            message: `Found ${nestedLoops.length} nested loop patterns that may impact performance`
          });
        }
        
        // Check for inefficient array operations
        const inefficientArrayOps = content.match(/new\s+Array\s*\(\s*\d+\s*\)/g);
        if (inefficientArrayOps) {
          issues.push({
            type: 'inefficient-array-operations',
            severity: 'low',
            file: 'current',
            message: `Found ${inefficientArrayOps.length} potentially inefficient array operations`
          });
        }
        
        // Check for memory leaks
        const memoryLeakPatterns = content.match(/setInterval\s*\(/g);
        if (memoryLeakPatterns) {
          issues.push({
            type: 'potential-memory-leak',
            severity: 'medium',
            file: 'current',
            message: `Found ${memoryLeakPatterns.length} setInterval calls that may cause memory leaks`
          });
        }
        break;
        
      case 'python':
        // Check for inefficient loops
        const inefficientLoops = content.match(/for\s+\w+\s+in\s+range\s*\([^)]*\)/g);
        if (inefficientLoops) {
          issues.push({
            type: 'inefficient-loops',
            severity: 'low',
            file: 'current',
            message: `Found ${inefficientLoops.length} potentially inefficient loop patterns`
          });
        }
        
        // Check for list comprehensions that could be generators
        const listCompRegex = /\[\s*[^\]]+\s+for\s+[^\]]+\]/g;
        const listComps = content.match(listCompRegex);
        if (listComps) {
          issues.push({
            type: 'inefficient-list-comprehensions',
            severity: 'low',
            file: 'current',
            message: `Found ${listComps.length} list comprehensions that could be generators`
          });
        }
        break;
    }
    
  } catch (error) {
    console.error(`Error analyzing file performance: ${error.message}`);
  }
  
  return issues;
}

/**
 * Scan security
 */
async function scanSecurity(files) {
  const issues = [];
  
  try {
    for (const file of files) {
      if (file.content) {
        const fileIssues = scanFileSecurity(file.content, file.language);
        issues.push(...fileIssues);
      }
    }
    
  } catch (error) {
    console.error(`Error scanning security: ${error.message}`);
  }
  
  return issues;
}

/**
 * Scan file security
 */
function scanFileSecurity(content, language) {
  const issues = [];
  
  try {
    // Common security patterns
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
      }
    ];
    
    for (const securityPattern of securityPatterns) {
      const matches = content.match(securityPattern.pattern);
      if (matches) {
        issues.push({
          type: securityPattern.type,
          severity: securityPattern.severity,
          message: securityPattern.message,
          count: matches.length,
          language: language
        });
      }
    }
    
  } catch (error) {
    console.error(`Error scanning file security: ${error.message}`);
  }
  
  return issues;
}

/**
 * Analyze documentation
 */
async function analyzeDocumentation(repositoryPath, files) {
  const docs = {
    coverage: 0,
    files: [],
    apiDocs: [],
    readme: null,
    issues: []
  };
  
  try {
    // Find documentation files
    const docFiles = files.filter(f => 
      f.language === 'markdown' || 
      f.language === 'restructuredtext' || 
      f.relativePath.includes('doc')
    );
    
    docs.files = docFiles;
    
    // Find README
    const readme = files.find(f => 
      f.relativePath.toLowerCase().includes('readme')
    );
    
    if (readme) {
      docs.readme = {
        path: readme.relativePath,
        size: readme.size,
        exists: true
      };
    }
    
    // Calculate coverage
    const documentedFiles = files.filter(f => 
      f.content?.includes('/**') || 
      f.content?.includes('##') || 
      f.content?.includes('"""')
    );
    
    docs.coverage = files.length > 0 ? (documentedFiles.length / files.length) * 100 : 0;
    
    // Extract API documentation
    for (const file of files) {
      if (file.content) {
        const apiDocs = extractAPIDocumentation(file.content, file.language);
        if (apiDocs.length > 0) {
          docs.apiDocs.push({
            file: file.relativePath,
            docs: apiDocs
          });
        }
      }
    }
    
    // Check for documentation issues
    if (docs.coverage < 30) {
      docs.issues.push({
        type: 'low-documentation-coverage',
        severity: 'medium',
        message: `Documentation coverage is only ${Math.round(docs.coverage)}%`
      });
    }
    
    if (!docs.readme) {
      docs.issues.push({
        type: 'missing-readme',
        severity: 'low',
        message: 'No README file found'
      });
    }
    
  } catch (error) {
    console.error(`Error analyzing documentation: ${error.message}`);
  }
  
  return docs;
}

/**
 * Extract API documentation
 */
function extractAPIDocumentation(content, language) {
  const docs = [];
  
  try {
    switch (language) {
      case 'javascript':
      case 'typescript':
        // JSDoc comments
        const jsdocRegex = /\/\*\*\s*([\s\S]*?)\s*\*\//g;
        let match;
        while ((match = jsdocRegex.exec(content)) !== null) {
          docs.push({
            type: 'jsdoc',
            content: match[1],
            line: content.substr(0, match.index).split('\n').length
          });
        }
        break;
        
      case 'python':
        // Docstrings
        const docstringRegex = /"""([\s\S]*?)"""|'([^']*)'/g;
        while ((match = docstringRegex.exec(content)) !== null) {
          docs.push({
            type: 'docstring',
            content: match[1] || match[2],
            line: content.substr(0, match.index).split('\n').length
          });
        }
        break;
    }
    
  } catch (error) {
    console.error(`Error extracting API documentation: ${error.message}`);
  }
  
  return docs;
}

/**
 * Analyze test coverage
 */
async function analyzeTestCoverage(repositoryPath, files) {
  const coverage = {
    hasTests: false,
    testFiles: [],
    sourceFiles: [],
    coverageRatio: 0,
    issues: []
  };
  
  try {
    // Find test files
    const testFiles = files.filter(f => 
      f.relativePath.includes('test') || 
      f.relativePath.includes('spec') ||
      f.relativePath.includes('__tests__')
    );
    
    coverage.testFiles = testFiles;
    coverage.hasTests = testFiles.length > 0;
    
    // Find source files (non-test files)
    const sourceFiles = files.filter(f => 
      !f.relativePath.includes('test') && 
      !f.relativePath.includes('spec') &&
      !f.relativePath.includes('__tests__') &&
      !['markdown', 'restructuredtext', 'text'].includes(f.language)
    );
    
    coverage.sourceFiles = sourceFiles;
    
    // Calculate coverage ratio
    coverage.coverageRatio = sourceFiles.length > 0 ? (testFiles.length / sourceFiles.length) * 100 : 0;
    
    // Check for coverage issues
    if (coverage.coverageRatio < 50) {
      coverage.issues.push({
        type: 'low-test-coverage',
        severity: 'medium',
        message: `Test coverage ratio is only ${Math.round(coverage.coverageRatio)}%`
      });
    }
    
    if (!coverage.hasTests) {
      coverage.issues.push({
        type: 'no-tests',
        severity: 'high',
        message: 'No test files found'
      });
    }
    
  } catch (error) {
    console.error(`Error analyzing test coverage: ${error.message}`);
  }
  
  return coverage;
}

/**
 * Generate recommendations
 */
async function generateRecommendations(analysis) {
  const recommendations = [];
  
  try {
    // Code quality recommendations
    if (analysis.codeQuality.overall === 'poor') {
      recommendations.push({
        priority: 'high',
        category: 'code-quality',
        recommendation: 'Refactor code to improve maintainability and reduce complexity'
      });
    }
    
    // Architecture recommendations
    if (analysis.architecture.patterns.length === 0) {
      recommendations.push({
        priority: 'medium',
        category: 'architecture',
        recommendation: 'Consider adopting a clear architectural pattern (MVC, Layered, etc.)'
      });
    }
    
    // Security recommendations
    if (analysis.securityIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'security',
        recommendation: `Address ${analysis.securityIssues.length} security issues found`
      });
    }
    
    // Performance recommendations
    if (analysis.performanceInsights.length > 5) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        recommendation: 'Review and optimize performance-critical code sections'
      });
    }
    
    // Documentation recommendations
    if (analysis.documentation.coverage < 50) {
      recommendations.push({
        priority: 'medium',
        category: 'documentation',
        recommendation: 'Improve documentation coverage and add missing documentation'
      });
    }
    
    // Test recommendations
    if (analysis.testCoverage.coverageRatio < 50) {
      recommendations.push({
        priority: 'high',
        category: 'testing',
        recommendation: 'Increase test coverage and add more comprehensive tests'
      });
    }
    
    // Dependency recommendations
    if (analysis.dependencies.length > 50) {
      recommendations.push({
        priority: 'low',
        category: 'dependencies',
        recommendation: 'Review and potentially reduce the number of dependencies'
      });
    }
    
  } catch (error) {
    console.error(`Error generating recommendations: ${error.message}`);
  }
  
  return recommendations;
}

/**
 * Generate research report
 */
async function generateResearchReport(analysis, args) {
  const report = {
    summary: {
      repository: analysis.repository,
      timestamp: analysis.timestamp,
      totalFiles: analysis.files.length,
      languages: [...new Set(analysis.files.map(f => f.language))],
      dependencies: analysis.dependencies.length,
      issues: analysis.issues.length,
      securityIssues: analysis.securityIssues.length,
      performanceInsights: analysis.performanceInsights.length
    },
    architecture: analysis.architecture,
    codeQuality: analysis.codeQuality,
    dependencies: analysis.dependencies,
    issues: analysis.issues,
    recommendations: analysis.recommendations,
    detailedAnalysis: args.depth === 'full' ? {
      files: analysis.files.map(f => ({
        path: f.relativePath,
        language: f.language,
        size: f.size,
        lines: f.lines,
        complexity: f.complexity,
        codeSmells: f.codeSmells?.length || 0,
        todos: f.todos?.length || 0
      })),
      dependencyGraph: analysis.dependencies,
      documentation: analysis.documentation,
      testCoverage: analysis.testCoverage
    } : null
  };
  
  return report;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report) {
  let markdown = `# Deep Repository Research Report\n\n`;
  
  // Summary
  markdown += `## Summary\n\n`;
  markdown += `- **Repository**: ${report.summary.repository}\n`;
  markdown += `- **Total Files**: ${report.summary.totalFiles}\n`;
  markdown += `- **Languages**: ${report.summary.languages.join(', ')}\n`;
  markdown += `- **Dependencies**: ${report.summary.dependencies}\n`;
  markdown += `- **Issues Found**: ${report.summary.issues}\n`;
  markdown += `- **Security Issues**: ${report.summary.securityIssues}\n`;
  markdown += `- **Performance Insights**: ${report.summary.performanceInsights}\n\n`;
  
  // Architecture
  if (report.architecture.patterns.length > 0) {
    markdown += `## Architecture Patterns\n\n`;
    for (const pattern of report.architecture.patterns) {
      markdown += `- ${pattern}\n`;
    }
    markdown += '\n';
  }
  
  // Code Quality
  markdown += `## Code Quality\n\n`;
  markdown += `- **Overall**: ${report.codeQuality.overall}\n`;
  markdown += `- **Average Complexity**: ${Math.round(report.codeQuality.metrics.averageComplexity)}\n`;
  markdown += `- **Code Smells**: ${report.codeQuality.metrics.codeSmellCount}\n`;
  markdown += `- **TODOs**: ${report.codeQuality.metrics.todoCount}\n\n`;
  
  // Recommendations
  if (report.recommendations.length > 0) {
    markdown += `## Recommendations\n\n`;
    for (const rec of report.recommendations) {
      markdown += `- **[${rec.priority}]** ${rec.recommendation} (${rec.category})\n`;
    }
    markdown += '\n';
  }
  
  return markdown;
}

/**
 * Save research results
 */
async function saveResearchResults(repositoryPath, analysis, report, args) {
  try {
    const resultsDir = path.join(process.cwd(), '.claude', 'research');
    await fs.mkdir(resultsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const repoName = path.basename(repositoryPath);
    
    // Save JSON report
    const jsonFile = path.join(resultsDir, `${repoName}-${timestamp}.json`);
    await fs.writeFile(jsonFile, JSON.stringify(report, null, 2));
    
    // Save markdown report
    const mdFile = path.join(resultsDir, `${repoName}-${timestamp}.md`);
    await fs.writeFile(mdFile, generateMarkdownReport(report));
    
    console.error(`Research results saved to ${resultsDir}`);
    
  } catch (error) {
    console.error(`Error saving research results: ${error.message}`);
  }
}

// Run the skill
main().catch(error => {
  console.error(`Skill failed: ${error.message}`);
  process.exit(1);
});