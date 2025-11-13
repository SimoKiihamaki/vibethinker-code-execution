#!/usr/bin/env node

/**
 * Architectural Analysis Skill
 * Analyzes software architecture patterns and provides design recommendations
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { execSync } from 'child_process';

/**
 * Main function for architectural analysis
 */
async function main() {
  try {
    const args = parseArguments();
    const projectPath = path.resolve(args.project);
    
    console.error(`🏗️  Architectural Analysis: ${projectPath}`);
    console.error(`   Format: ${args.format}`);
    console.error(`   Depth: ${args.depth}`);
    console.error(`   Patterns: ${args.patterns.join(', ')}`);
    
    // Validate project path
    if (!await validateProject(projectPath)) {
      throw new Error(`Invalid project path: ${projectPath}`);
    }
    
    // Perform architectural analysis
    const analysis = await performArchitecturalAnalysis(projectPath, args);
    
    // Generate architectural report
    const report = await generateArchitecturalReport(analysis, args);
    
    // Save results
    await saveArchitecturalResults(projectPath, analysis, report, args);
    
    console.error(`✅ Architectural analysis completed`);
    console.error(`   Patterns detected: ${analysis.patterns.length}`);
    console.error(`   Components: ${analysis.components.length}`);
    console.error(`   Dependencies: ${analysis.dependencies.length}`);
    console.error(`   Issues: ${analysis.issues.length}`);
    
    // Output results
    if (args.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else if (args.format === 'md') {
      console.log(generateMarkdownReport(report));
    } else if (args.format === 'graph') {
      console.log(JSON.stringify(generateGraphData(report), null, 2));
    }
    
  } catch (error) {
    console.error(`❌ Architectural analysis error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = {
    project: process.argv[2] || '.',
    format: 'json',
    depth: 'overview',
    patterns: [],
    visualize: false,
    recommend: false,
    compare: null
  };
  
  // Parse additional arguments
  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    if (arg.startsWith('--format=')) {
      args.format = arg.split('=')[1];
    } else if (arg.startsWith('--depth=')) {
      args.depth = arg.split('=')[1];
    } else if (arg.startsWith('--patterns=')) {
      args.patterns = arg.split('=')[1].split(',');
    } else if (arg === '--visualize') {
      args.visualize = true;
    } else if (arg === '--recommend') {
      args.recommend = true;
    } else if (arg.startsWith('--compare=')) {
      args.compare = arg.split('=')[1];
    }
  }
  
  // Auto-detect patterns if not specified
  if (args.patterns.length === 0) {
    args.patterns = ['all'];
  }
  
  return args;
}

/**
 * Validate project path
 */
async function validateProject(projectPath) {
  try {
    const stat = await fs.stat(projectPath);
    return stat.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Perform architectural analysis
 */
async function performArchitecturalAnalysis(projectPath, args) {
  const analysis = {
    project: projectPath,
    timestamp: new Date().toISOString(),
    patterns: [],
    components: [],
    dependencies: [],
    relationships: [],
    metrics: {},
    issues: [],
    recommendations: [],
    technologyStack: {},
    scalability: {},
    maintainability: {}
  };
  
  try {
    // Discover project structure
    const projectStructure = await discoverProjectStructure(projectPath);
    
    // Analyze technology stack
    analysis.technologyStack = await analyzeTechnologyStack(projectPath);
    
    // Detect architectural patterns
    analysis.patterns = await detectArchitecturalPatterns(projectPath, projectStructure, args);
    
    // Identify components
    analysis.components = await identifyComponents(projectPath, projectStructure, args);
    
    // Analyze dependencies
    analysis.dependencies = await analyzeDependencies(projectPath, analysis.components);
    
    // Map relationships
    analysis.relationships = await mapComponentRelationships(analysis.components, analysis.dependencies);
    
    // Calculate metrics
    analysis.metrics = await calculateArchitecturalMetrics(analysis);
    
    // Assess scalability
    analysis.scalability = await assessScalability(analysis);
    
    // Evaluate maintainability
    analysis.maintainability = await evaluateMaintainability(analysis);
    
    // Compare with baseline if provided
    if (args.compare) {
      analysis.comparison = await compareWithBaseline(analysis, args.compare);
    }
    
    // Generate recommendations
    if (args.recommend) {
      analysis.recommendations = await generateArchitecturalRecommendations(analysis);
    }
    
    // Identify issues
    analysis.issues = await identifyArchitecturalIssues(analysis);
    
  } catch (error) {
    console.error(`Error during architectural analysis: ${error.message}`);
    analysis.issues.push({
      type: 'analysis-error',
      severity: 'high',
      message: error.message
    });
  }
  
  return analysis;
}

/**
 * Discover project structure
 */
async function discoverProjectStructure(projectPath) {
  const structure = {
    root: projectPath,
    directories: [],
    files: [],
    configFiles: [],
    entryPoints: [],
    layers: []
  };
  
  try {
    // Find configuration files
    const configPatterns = [
      'package.json', 'requirements.txt', 'pom.xml', 'build.gradle',
      'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
      '.gitignore', 'README.md', 'tsconfig.json', 'webpack.config.js'
    ];
    
    for (const pattern of configPatterns) {
      try {
        const files = await glob(pattern, { cwd: projectPath });
        for (const file of files) {
          structure.configFiles.push(path.join(projectPath, file));
        }
      } catch (error) {
        console.error(`Error finding config files with pattern ${pattern}: ${error.message}`);
      }
    }
    
    // Discover directories
    const directories = await discoverDirectories(projectPath);
    structure.directories = directories;
    
    // Find entry points
    structure.entryPoints = await findEntryPoints(projectPath);
    
    // Identify layers based on directory structure
    structure.layers = await identifyLayers(directories);
    
  } catch (error) {
    console.error(`Error discovering project structure: ${error.message}`);
  }
  
  return structure;
}

/**
 * Discover directories
 */
async function discoverDirectories(projectPath) {
  const directories = [];
  
  try {
    const items = await fs.readdir(projectPath);
    
    for (const item of items) {
      const fullPath = path.join(projectPath, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        directories.push({
          name: item,
          path: fullPath,
          size: await getDirectorySize(fullPath),
          files: await countFilesInDirectory(fullPath)
        });
        
        // Recursively discover subdirectories
        const subdirs = await discoverDirectories(fullPath);
        directories.push(...subdirs);
      }
    }
    
  } catch (error) {
    console.error(`Error discovering directories: ${error.message}`);
  }
  
  return directories;
}

/**
 * Get directory size
 */
async function getDirectorySize(dirPath) {
  let size = 0;
  
  try {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isFile()) {
        size += stat.size;
      } else if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        size += await getDirectorySize(fullPath);
      }
    }
    
  } catch (error) {
    console.error(`Error getting directory size for ${dirPath}: ${error.message}`);
  }
  
  return size;
}

/**
 * Count files in directory
 */
async function countFilesInDirectory(dirPath) {
  let count = 0;
  
  try {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = await fs.stat(fullPath);
      
      if (stat.isFile()) {
        count++;
      } else if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        count += await countFilesInDirectory(fullPath);
      }
    }
    
  } catch (error) {
    console.error(`Error counting files in directory ${dirPath}: ${error.message}`);
  }
  
  return count;
}

/**
 * Find entry points
 */
async function findEntryPoints(projectPath) {
  const entryPoints = [];
  
  try {
    // Common entry point patterns
    const patterns = [
      'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts',
      'server.js', 'server.ts', 'index.py', 'main.py', 'app.py'
    ];
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, { cwd: projectPath });
        for (const file of files) {
          entryPoints.push(path.join(projectPath, file));
        }
      } catch (error) {
        console.error(`Error finding entry points with pattern ${pattern}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error(`Error finding entry points: ${error.message}`);
  }
  
  return entryPoints;
}

/**
 * Identify layers
 */
async function identifyLayers(directories) {
  const layers = [];
  
  try {
    const layerPatterns = {
      presentation: ['view', 'ui', 'presentation', 'frontend', 'client'],
      business: ['service', 'business', 'logic', 'domain'],
      data: ['model', 'data', 'repository', 'dao', 'database', 'db'],
      infrastructure: ['config', 'util', 'helper', 'infrastructure'],
      api: ['api', 'controller', 'endpoint', 'route'],
      test: ['test', 'spec', 'mock']
    };
    
    for (const [layerType, patterns] of Object.entries(layerPatterns)) {
      const matchingDirs = directories.filter(dir => 
        patterns.some(pattern => 
          dir.name.toLowerCase().includes(pattern)
        )
      );
      
      if (matchingDirs.length > 0) {
        layers.push({
          type: layerType,
          directories: matchingDirs,
          confidence: matchingDirs.length / directories.length
        });
      }
    }
    
  } catch (error) {
    console.error(`Error identifying layers: ${error.message}`);
  }
  
  return layers;
}

/**
 * Analyze technology stack
 */
async function analyzeTechnologyStack(projectPath) {
  const stack = {
    languages: [],
    frameworks: [],
    databases: [],
    libraries: [],
    tools: [],
    platforms: []
  };
  
  try {
    // Analyze package.json for Node.js projects
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      // Detect frameworks
      if (packageJson.dependencies?.react) stack.frameworks.push('React');
      if (packageJson.dependencies?.vue) stack.frameworks.push('Vue.js');
      if (packageJson.dependencies?.angular) stack.frameworks.push('Angular');
      if (packageJson.dependencies?.express) stack.frameworks.push('Express.js');
      if (packageJson.dependencies?.['@nestjs/core']) stack.frameworks.push('NestJS');
      
      // Detect databases
      if (packageJson.dependencies?.mongoose) stack.databases.push('MongoDB');
      if (packageJson.dependencies?.['pg']) stack.databases.push('PostgreSQL');
      if (packageJson.dependencies?.mysql2) stack.databases.push('MySQL');
      
      // Detect tools and libraries
      Object.keys(packageJson.dependencies || {}).forEach(dep => {
        if (dep.includes('test') || dep.includes('jest') || dep.includes('mocha')) {
          stack.tools.push('Testing Framework');
        }
        if (dep.includes('webpack') || dep.includes('vite')) {
          stack.tools.push('Build Tool');
        }
      });
      
    } catch (error) {
      // No package.json
    }
    
    // Analyze requirements.txt for Python projects
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    try {
      const requirements = await fs.readFile(requirementsPath, 'utf8');
      
      if (requirements.includes('django')) stack.frameworks.push('Django');
      if (requirements.includes('flask')) stack.frameworks.push('Flask');
      if (requirements.includes('fastapi')) stack.frameworks.push('FastAPI');
      if (requirements.includes('sqlalchemy')) stack.libraries.push('SQLAlchemy');
      if (requirements.includes('pandas')) stack.libraries.push('Pandas');
      if (requirements.includes('numpy')) stack.libraries.push('NumPy');
      
    } catch (error) {
      // No requirements.txt
    }
    
    // Detect languages by file extension
    const extensions = await detectFileExtensions(projectPath);
    if (extensions.includes('.js') || extensions.includes('.ts')) stack.languages.push('JavaScript/TypeScript');
    if (extensions.includes('.py')) stack.languages.push('Python');
    if (extensions.includes('.java')) stack.languages.push('Java');
    if (extensions.includes('.go')) stack.languages.push('Go');
    if (extensions.includes('.rs')) stack.languages.push('Rust');
    
    // Detect platforms
    const dockerfilePath = path.join(projectPath, 'Dockerfile');
    try {
      await fs.access(dockerfilePath);
      stack.platforms.push('Docker');
    } catch (error) {
      // No Dockerfile
    }
    
    const dockerComposePath = path.join(projectPath, 'docker-compose.yml');
    try {
      await fs.access(dockerComposePath);
      stack.platforms.push('Docker Compose');
    } catch (error) {
      // No docker-compose.yml
    }
    
  } catch (error) {
    console.error(`Error analyzing technology stack: ${error.message}`);
  }
  
  return stack;
}

/**
 * Detect file extensions
 */
async function detectFileExtensions(projectPath) {
  const extensions = new Set();
  
  try {
    const files = await glob('**/*', { 
      cwd: projectPath,
      ignore: ['node_modules/**', '.git/**']
    });
    
    for (const file of files) {
      const ext = path.extname(file);
      if (ext) {
        extensions.add(ext);
      }
    }
    
  } catch (error) {
    console.error(`Error detecting file extensions: ${error.message}`);
  }
  
  return Array.from(extensions);
}

/**
 * Detect architectural patterns
 */
async function detectArchitecturalPatterns(projectPath, projectStructure, args) {
  const patterns = [];
  
  try {
    const requestedPatterns = args.patterns.includes('all') ? 
      ['mvc', 'layered', 'microservices', 'event-driven', 'cqrs', 'hexagonal'] : 
      args.patterns;
    
    for (const pattern of requestedPatterns) {
      const detected = await detectPattern(pattern, projectPath, projectStructure);
      if (detected.detected) {
        patterns.push({
          name: pattern,
          confidence: detected.confidence,
          evidence: detected.evidence,
          description: getPatternDescription(pattern)
        });
      }
    }
    
  } catch (error) {
    console.error(`Error detecting architectural patterns: ${error.message}`);
  }
  
  return patterns;
}

/**
 * Detect specific pattern
 */
async function detectPattern(pattern, projectPath, projectStructure) {
  const result = {
    detected: false,
    confidence: 0,
    evidence: []
  };
  
  try {
    switch (pattern) {
      case 'mvc':
        result.detected = await detectMVC(projectPath, projectStructure);
        break;
      case 'layered':
        result.detected = await detectLayered(projectPath, projectStructure);
        break;
      case 'microservices':
        result.detected = await detectMicroservices(projectPath, projectStructure);
        break;
      case 'event-driven':
        result.detected = await detectEventDriven(projectPath, projectStructure);
        break;
      case 'cqrs':
        result.detected = await detectCQRS(projectPath, projectStructure);
        break;
      case 'hexagonal':
        result.detected = await detectHexagonal(projectPath, projectStructure);
        break;
    }
    
    if (result.detected.detected) {
      result.confidence = result.detected.confidence;
      result.evidence = result.detected.evidence;
    }
    
  } catch (error) {
    console.error(`Error detecting pattern ${pattern}: ${error.message}`);
  }
  
  return result;
}

/**
 * Detect MVC pattern
 */
async function detectMVC(projectPath, projectStructure) {
  const result = {
    detected: false,
    confidence: 0,
    evidence: []
  };
  
  try {
    const hasModels = projectStructure.directories.some(dir => 
      dir.name.toLowerCase().includes('model')
    );
    
    const hasViews = projectStructure.directories.some(dir => 
      dir.name.toLowerCase().includes('view') || dir.name.toLowerCase().includes('ui')
    );
    
    const hasControllers = projectStructure.directories.some(dir => 
      dir.name.toLowerCase().includes('controller')
    );
    
    if (hasModels && hasViews && hasControllers) {
      result.detected = true;
      result.confidence = 0.8;
      result.evidence = ['Model directories found', 'View directories found', 'Controller directories found'];
    }
    
  } catch (error) {
    console.error(`Error detecting MVC pattern: ${error.message}`);
  }
  
  return result;
}

/**
 * Detect layered pattern
 */
async function detectLayered(projectPath, projectStructure) {
  const result = {
    detected: false,
    confidence: 0,
    evidence: []
  };
  
  try {
    const hasPresentation = projectStructure.directories.some(dir => 
      dir.name.toLowerCase().includes('presentation') || dir.name.toLowerCase().includes('ui')
    );
    
    const hasBusiness = projectStructure.directories.some(dir => 
      dir.name.toLowerCase().includes('business') || dir.name.toLowerCase().includes('service')
    );
    
    const hasData = projectStructure.directories.some(dir => 
      dir.name.toLowerCase().includes('data') || dir.name.toLowerCase().includes('repository')
    );
    
    if (hasPresentation && hasBusiness && hasData) {
      result.detected = true;
      result.confidence = 0.75;
      result.evidence = ['Presentation layer found', 'Business layer found', 'Data layer found'];
    }
    
  } catch (error) {
    console.error(`Error detecting layered pattern: ${error.message}`);
  }
  
  return result;
}

/**
 * Detect microservices pattern
 */
async function detectMicroservices(projectPath, projectStructure) {
  const result = {
    detected: false,
    confidence: 0,
    evidence: []
  };
  
  try {
    // Check for multiple services
    const serviceDirectories = projectStructure.directories.filter(dir => 
      dir.name.toLowerCase().includes('service') || dir.name.toLowerCase().includes('micro')
    );
    
    if (serviceDirectories.length > 2) {
      result.detected = true;
      result.confidence = 0.7;
      result.evidence = [`${serviceDirectories.length} service directories found`];
    }
    
    // Check for API gateway or service discovery
    const hasApiGateway = projectStructure.directories.some(dir => 
      dir.name.toLowerCase().includes('gateway') || dir.name.toLowerCase().includes('proxy')
    );
    
    if (hasApiGateway) {
      result.confidence += 0.1;
      result.evidence.push('API Gateway pattern detected');
    }
    
  } catch (error) {
    console.error(`Error detecting microservices pattern: ${error.message}`);
  }
  
  return result;
}

/**
 * Detect event-driven pattern
 */
async function detectEventDriven(projectPath, projectStructure) {
  const result = {
    detected: false,
    confidence: 0,
    evidence: []
  };
  
  try {
    // Look for event-related files
    const eventFiles = await glob('**/*event*', { cwd: projectPath });
    const messageFiles = await glob('**/*message*', { cwd: projectPath });
    const queueFiles = await glob('**/*queue*', { cwd: projectPath });
    
    if (eventFiles.length > 0 || messageFiles.length > 0 || queueFiles.length > 0) {
      result.detected = true;
      result.confidence = 0.6;
      result.evidence = [
        `${eventFiles.length} event-related files`,
        `${messageFiles.length} message-related files`,
        `${queueFiles.length} queue-related files`
      ].filter(e => e.includes('0 files') === false);
    }
    
  } catch (error) {
    console.error(`Error detecting event-driven pattern: ${error.message}`);
  }
  
  return result;
}

/**
 * Detect CQRS pattern
 */
async function detectCQRS(projectPath, projectStructure) {
  const result = {
    detected: false,
    confidence: 0,
    evidence: []
  };
  
  try {
    // Look for command and query separation
    const commandFiles = await glob('**/*command*', { cwd: projectPath });
    const queryFiles = await glob('**/*query*', { cwd: projectPath });
    
    if (commandFiles.length > 0 && queryFiles.length > 0) {
      result.detected = true;
      result.confidence = 0.65;
      result.evidence = [
        `${commandFiles.length} command-related files`,
        `${queryFiles.length} query-related files`
      ];
    }
    
  } catch (error) {
    console.error(`Error detecting CQRS pattern: ${error.message}`);
  }
  
  return result;
}

/**
 * Detect hexagonal pattern
 */
async function detectHexagonal(projectPath, projectStructure) {
  const result = {
    detected: false,
    confidence: 0,
    evidence: []
  };
  
  try {
    // Look for port and adapter patterns
    const portFiles = await glob('**/*port*', { cwd: projectPath });
    const adapterFiles = await glob('**/*adapter*', { cwd: projectPath });
    const coreFiles = await glob('**/*core*', { cwd: projectPath });
    
    if (portFiles.length > 0 || adapterFiles.length > 0 || coreFiles.length > 0) {
      result.detected = true;
      result.confidence = 0.6;
      result.evidence = [
        `${portFiles.length} port-related files`,
        `${adapterFiles.length} adapter-related files`,
        `${coreFiles.length} core-related files`
      ].filter(e => e.includes('0 files') === false);
    }
    
  } catch (error) {
    console.error(`Error detecting hexagonal pattern: ${error.message}`);
  }
  
  return result;
}

/**
 * Get pattern description
 */
function getPatternDescription(pattern) {
  const descriptions = {
    mvc: 'Model-View-Controller pattern separates application logic, user interface, and user input',
    layered: 'Layered architecture organizes code into distinct layers with specific responsibilities',
    microservices: 'Microservices architecture decomposes applications into small, independent services',
    'event-driven': 'Event-driven architecture uses events to trigger and communicate between components',
    cqrs: 'Command Query Responsibility Segregation separates read and write operations',
    hexagonal: 'Hexagonal architecture isolates business logic from external dependencies'
  };
  
  return descriptions[pattern] || 'Unknown pattern';
}

/**
 * Identify components
 */
async function identifyComponents(projectPath, projectStructure, args) {
  const components = [];
  
  try {
    // Identify components based on file structure and naming conventions
    const componentFiles = await findComponentFiles(projectPath);
    
    for (const file of componentFiles) {
      const component = await analyzeComponent(file, projectPath);
      if (component) {
        components.push(component);
      }
    }
    
    // Identify service components
    const serviceComponents = await identifyServiceComponents(projectPath);
    components.push(...serviceComponents);
    
    // Identify data components
    const dataComponents = await identifyDataComponents(projectPath);
    components.push(...dataComponents);
    
  } catch (error) {
    console.error(`Error identifying components: ${error.message}`);
  }
  
  return components;
}

/**
 * Find component files
 */
async function findComponentFiles(projectPath) {
  const componentFiles = [];
  
  try {
    // Common component patterns
    const patterns = [
      '**/*component*.{js,ts,jsx,tsx,vue}',
      '**/*service*.{js,ts,py,java,go}',
      '**/*controller*.{js,ts,py,java}',
      '**/*module*.{js,ts,py,java}',
      '**/*widget*.{js,ts,jsx,tsx,vue}'
    ];
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, { cwd: projectPath });
        componentFiles.push(...files.map(f => path.join(projectPath, f)));
      } catch (error) {
        console.error(`Error finding component files with pattern ${pattern}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error(`Error finding component files: ${error.message}`);
  }
  
  return componentFiles;
}

/**
 * Analyze component
 */
async function analyzeComponent(filePath, projectPath) {
  try {
    const stat = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf8');
    
    const component = {
      name: path.basename(filePath, path.extname(filePath)),
      path: filePath,
      relativePath: path.relative(projectPath, filePath),
      size: stat.size,
      type: classifyComponent(filePath, content),
      complexity: analyzeComponentComplexity(content),
      dependencies: extractComponentDependencies(content),
      interfaces: extractComponentInterfaces(content),
      responsibilities: analyzeComponentResponsibilities(content)
    };
    
    return component;
    
  } catch (error) {
    console.error(`Error analyzing component ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Classify component
 */
function classifyComponent(filePath, content) {
  const fileName = path.basename(filePath).toLowerCase();
  
  if (fileName.includes('component')) return 'ui-component';
  if (fileName.includes('service')) return 'service';
  if (fileName.includes('controller')) return 'controller';
  if (fileName.includes('module')) return 'module';
  if (fileName.includes('widget')) return 'widget';
  if (fileName.includes('model')) return 'model';
  if (fileName.includes('repository')) return 'repository';
  if (fileName.includes('adapter')) return 'adapter';
  if (fileName.includes('gateway')) return 'gateway';
  
  return 'unknown';
}

/**
 * Analyze component complexity
 */
function analyzeComponentComplexity(content) {
  const complexity = {
    lines: content.split('\n').length,
    functions: 0,
    classes: 0,
    imports: 0,
    cyclomatic: 1
  };
  
  try {
    // Count functions
    complexity.functions = (content.match(/function\s+\w+/g) || []).length;
    complexity.functions += (content.match(/=>\s*{/g) || []).length;
    
    // Count classes
    complexity.classes = (content.match(/class\s+\w+/g) || []).length;
    
    // Count imports
    complexity.imports = (content.match(/import\s+/g) || []).length;
    complexity.imports += (content.match(/require\s*\(/g) || []).length;
    
    // Calculate cyclomatic complexity (simplified)
    const conditionals = content.match(/if\s*\(|else\s*\{|case\s+\w+|default\s*:/g) || [];
    complexity.cyclomatic = Math.max(1, conditionals.length);
    
  } catch (error) {
    console.error(`Error analyzing component complexity: ${error.message}`);
  }
  
  return complexity;
}

/**
 * Extract component dependencies
 */
function extractComponentDependencies(content) {
  const dependencies = [];
  
  try {
    // Extract import statements
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push({
        type: 'import',
        module: match[1],
        line: content.substr(0, match.index).split('\n').length
      });
    }
    
    // Extract require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.push({
        type: 'require',
        module: match[1],
        line: content.substr(0, match.index).split('\n').length
      });
    }
    
  } catch (error) {
    console.error(`Error extracting component dependencies: ${error.message}`);
  }
  
  return dependencies;
}

/**
 * Extract component interfaces
 */
function extractComponentInterfaces(content) {
  const interfaces = [];
  
  try {
    // Extract function signatures
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      interfaces.push({
        type: 'function',
        name: match[1],
        parameters: match[2].split(',').map(p => p.trim()).filter(p => p),
        line: content.substr(0, match.index).split('\n').length
      });
    }
    
    // Extract class methods
    const methodRegex = /(\w+)\s*\(([^)]*)\)\s*{/g;
    while ((match = methodRegex.exec(content)) !== null) {
      interfaces.push({
        type: 'method',
        name: match[1],
        parameters: match[2].split(',').map(p => p.trim()).filter(p => p),
        line: content.substr(0, match.index).split('\n').length
      });
    }
    
  } catch (error) {
    console.error(`Error extracting component interfaces: ${error.message}`);
  }
  
  return interfaces;
}

/**
 * Analyze component responsibilities
 */
function analyzeComponentResponsibilities(content) {
  const responsibilities = [];
  
  try {
    // Look for responsibility indicators in comments
    const commentRegex = /\/\*\*?\s*([\s\S]*?)\s*\*?\//g;
    let match;
    while ((match = commentRegex.exec(content)) !== null) {
      const comment = match[1].replace(/\*\s*/g, '').trim();
      if (comment.length > 10) {
        responsibilities.push({
          type: 'documentation',
          description: comment,
          line: content.substr(0, match.index).split('\n').length
        });
      }
    }
    
    // Look for function names that indicate responsibilities
    const functionNames = (content.match(/function\s+(\w+)/g) || [])
      .map(fn => fn.replace('function ', ''));
    
    for (const functionName of functionNames) {
      if (functionName.includes('create') || functionName.includes('add')) {
        responsibilities.push({
          type: 'creation',
          description: `Creates or adds ${functionName.replace('create', '').replace('add', '')}`,
          function: functionName
        });
      } else if (functionName.includes('update') || functionName.includes('modify')) {
        responsibilities.push({
          type: 'modification',
          description: `Updates or modifies ${functionName.replace('update', '').replace('modify', '')}`,
          function: functionName
        });
      } else if (functionName.includes('delete') || functionName.includes('remove')) {
        responsibilities.push({
          type: 'deletion',
          description: `Deletes or removes ${functionName.replace('delete', '').replace('remove', '')}`,
          function: functionName
        });
      }
    }
    
  } catch (error) {
    console.error(`Error analyzing component responsibilities: ${error.message}`);
  }
  
  return responsibilities;
}

/**
 * Identify service components
 */
async function identifyServiceComponents(projectPath) {
  const services = [];
  
  try {
    // Look for service files
    const serviceFiles = await glob('**/*service*.{js,ts,py,java,go}', { cwd: projectPath });
    
    for (const file of serviceFiles) {
      const fullPath = path.join(projectPath, file);
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        const stat = await fs.stat(fullPath);
        
        services.push({
          name: path.basename(file, path.extname(file)),
          path: fullPath,
          relativePath: file,
          size: stat.size,
          type: 'service',
          complexity: analyzeComponentComplexity(content),
          responsibilities: analyzeComponentResponsibilities(content)
        });
      } catch (error) {
        console.error(`Error analyzing service file ${file}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error(`Error identifying service components: ${error.message}`);
  }
  
  return services;
}

/**
 * Identify data components
 */
async function identifyDataComponents(projectPath) {
  const dataComponents = [];
  
  try {
    // Look for data/model files
    const dataFiles = await glob('**/*{model,data,entity,repository}*.{js,ts,py,java}', { cwd: projectPath });
    
    for (const file of dataFiles) {
      const fullPath = path.join(projectPath, file);
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        const stat = await fs.stat(fullPath);
        
        dataComponents.push({
          name: path.basename(file, path.extname(file)),
          path: fullPath,
          relativePath: file,
          size: stat.size,
          type: 'data',
          complexity: analyzeComponentComplexity(content),
          responsibilities: analyzeComponentResponsibilities(content)
        });
      } catch (error) {
        console.error(`Error analyzing data file ${file}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error(`Error identifying data components: ${error.message}`);
  }
  
  return dataComponents;
}

/**
 * Analyze dependencies
 */
async function analyzeDependencies(projectPath, components) {
  const dependencies = {
    external: [],
    internal: [],
    patterns: [],
    metrics: {}
  };
  
  try {
    // Analyze external dependencies
    dependencies.external = await analyzeExternalDependencies(projectPath);
    
    // Analyze internal dependencies
    dependencies.internal = await analyzeInternalDependencies(components);
    
    // Analyze dependency patterns
    dependencies.patterns = await analyzeDependencyPatterns([...dependencies.external, ...dependencies.internal]);
    
    // Calculate metrics
    dependencies.metrics = calculateDependencyMetrics([...dependencies.external, ...dependencies.internal]);
    
  } catch (error) {
    console.error(`Error analyzing dependencies: ${error.message}`);
  }
  
  return dependencies;
}

/**
 * Analyze external dependencies
 */
async function analyzeExternalDependencies(projectPath) {
  const dependencies = [];
  
  try {
    // Analyze package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      Object.entries(packageJson.dependencies || {}).forEach(([name, version]) => {
        dependencies.push({
          type: 'npm',
          name: name,
          version: version,
          category: categorizeDependency(name),
          isDev: false
        });
      });
      
      Object.entries(packageJson.devDependencies || {}).forEach(([name, version]) => {
        dependencies.push({
          type: 'npm',
          name: name,
          version: version,
          category: categorizeDependency(name),
          isDev: true
        });
      });
      
    } catch (error) {
      // No package.json
    }
    
    // Analyze requirements.txt
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    try {
      const requirements = await fs.readFile(requirementsPath, 'utf8');
      const lines = requirements.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      
      for (const line of lines) {
        const [name, version] = line.split(/[>=<]/);
        dependencies.push({
          type: 'pip',
          name: name.trim(),
          version: version ? version.trim() : 'unknown',
          category: categorizeDependency(name.trim()),
          isDev: false
        });
      }
      
    } catch (error) {
      // No requirements.txt
    }
    
  } catch (error) {
    console.error(`Error analyzing external dependencies: ${error.message}`);
  }
  
  return dependencies;
}

/**
 * Categorize dependency
 */
function categorizeDependency(name) {
  const categories = {
    framework: ['react', 'vue', 'angular', 'express', 'nestjs', 'django', 'flask', 'fastapi'],
    database: ['mongoose', 'pg', 'mysql2', 'sqlite3', 'redis', 'mongodb'],
    testing: ['jest', 'mocha', 'jasmine', 'pytest', 'unittest'],
    build: ['webpack', 'vite', 'rollup', 'parcel'],
    utility: ['lodash', 'underscore', 'moment', 'axios', 'requests']
  };
  
  for (const [category, patterns] of Object.entries(categories)) {
    if (patterns.some(pattern => name.toLowerCase().includes(pattern))) {
      return category;
    }
  }
  
  return 'other';
}

/**
 * Analyze internal dependencies
 */
async function analyzeInternalDependencies(components) {
  const dependencies = [];
  
  try {
    for (const component of components) {
      if (component.dependencies) {
        for (const dep of component.dependencies) {
          // Check if dependency is internal (another component)
          const targetComponent = components.find(c => 
            c.name === dep.name || 
            dep.module?.includes(c.name.toLowerCase())
          );
          
          if (targetComponent) {
            dependencies.push({
              type: 'internal',
              from: component.name,
              to: targetComponent.name,
              relationship: 'depends-on',
              strength: calculateDependencyStrength(dep)
            });
          }
        }
      }
    }
    
  } catch (error) {
    console.error(`Error analyzing internal dependencies: ${error.message}`);
  }
  
  return dependencies;
}

/**
 * Calculate dependency strength
 */
function calculateDependencyStrength(dep) {
  // Simple heuristic based on usage patterns
  if (dep.type === 'import' && dep.module) {
    if (dep.module.startsWith('.')) return 'strong';
    if (dep.module.includes('/')) return 'medium';
    return 'weak';
  }
  return 'unknown';
}

/**
 * Analyze dependency patterns
 */
async function analyzeDependencyPatterns(dependencies) {
  const patterns = [];
  
  try {
    // Circular dependency detection
    const circularDeps = detectCircularDependencies(dependencies);
    if (circularDeps.length > 0) {
      patterns.push({
        type: 'circular',
        severity: 'high',
        count: circularDeps.length,
        description: 'Circular dependencies detected'
      });
    }
    
    // God object detection (too many dependencies)
    const godObjects = detectGodObjects(dependencies);
    if (godObjects.length > 0) {
      patterns.push({
        type: 'god-object',
        severity: 'medium',
        count: godObjects.length,
        description: 'Components with too many dependencies'
      });
    }
    
    // Orphan detection (no dependencies)
    const orphans = detectOrphans(dependencies);
    if (orphans.length > 0) {
      patterns.push({
        type: 'orphan',
        severity: 'low',
        count: orphans.length,
        description: 'Components with no dependencies'
      });
    }
    
  } catch (error) {
    console.error(`Error analyzing dependency patterns: ${error.message}`);
  }
  
  return patterns;
}

/**
 * Detect circular dependencies
 */
function detectCircularDependencies(dependencies) {
  const circular = [];
  
  try {
    // Build dependency graph
    const graph = {};
    dependencies.forEach(dep => {
      if (dep.from && dep.to) {
        if (!graph[dep.from]) graph[dep.from] = [];
        graph[dep.from].push(dep.to);
      }
    });
    
    // Simple cycle detection
    for (const [node, neighbors] of Object.entries(graph)) {
      for (const neighbor of neighbors) {
        if (graph[neighbor] && graph[neighbor].includes(node)) {
          circular.push({
            from: node,
            to: neighbor,
            type: 'circular'
          });
        }
      }
    }
    
  } catch (error) {
    console.error(`Error detecting circular dependencies: ${error.message}`);
  }
  
  return circular;
}

/**
 * Detect god objects
 */
function detectGodObjects(dependencies) {
  const godObjects = [];
  
  try {
    // Count dependencies per component
    const dependencyCount = {};
    dependencies.forEach(dep => {
      if (dep.from) {
        dependencyCount[dep.from] = (dependencyCount[dep.from] || 0) + 1;
      }
    });
    
    // Identify components with too many dependencies (threshold: 10)
    for (const [component, count] of Object.entries(dependencyCount)) {
      if (count > 10) {
        godObjects.push({
          component: component,
          dependencyCount: count,
          severity: count > 20 ? 'high' : 'medium'
        });
      }
    }
    
  } catch (error) {
    console.error(`Error detecting god objects: ${error.message}`);
  }
  
  return godObjects;
}

/**
 * Detect orphans
 */
function detectOrphans(dependencies) {
  const orphans = [];
  
  try {
    const allComponents = new Set();
    const dependentComponents = new Set();
    
    dependencies.forEach(dep => {
      if (dep.from) allComponents.add(dep.from);
      if (dep.to) {
        allComponents.add(dep.to);
        dependentComponents.add(dep.to);
      }
    });
    
    // Find components that are not depended upon
    for (const component of allComponents) {
      if (!dependentComponents.has(component)) {
        orphans.push({
          component: component,
          type: 'orphan'
        });
      }
    }
    
  } catch (error) {
    console.error(`Error detecting orphans: ${error.message}`);
  }
  
  return orphans;
}

/**
 * Calculate dependency metrics
 */
function calculateDependencyMetrics(dependencies) {
  const metrics = {
    total: dependencies.length,
    internal: 0,
    external: 0,
    circular: 0,
    averagePerComponent: 0,
    couplingCoefficient: 0
  };
  
  try {
    const internal = dependencies.filter(d => d.type === 'internal').length;
    const external = dependencies.filter(d => d.type !== 'internal').length;
    const circular = dependencies.filter(d => d.type === 'circular').length;
    
    metrics.internal = internal;
    metrics.external = external;
    metrics.circular = circular;
    
    // Calculate average dependencies per component
    const components = new Set();
    dependencies.forEach(dep => {
      if (dep.from) components.add(dep.from);
    });
    
    metrics.averagePerComponent = components.size > 0 ? metrics.total / components.size : 0;
    
    // Calculate coupling coefficient (simplified)
    metrics.couplingCoefficient = components.size > 0 ? 
      (internal / (components.size * (components.size - 1) / 2)) : 0;
    
  } catch (error) {
    console.error(`Error calculating dependency metrics: ${error.message}`);
  }
  
  return metrics;
}

/**
 * Map component relationships
 */
async function mapComponentRelationships(components, dependencies) {
  const relationships = [];
  
  try {
    // Create relationship map
    for (const dep of dependencies) {
      if (dep.from && dep.to) {
        relationships.push({
          from: dep.from,
          to: dep.to,
          type: dep.relationship || 'depends-on',
          strength: dep.strength || 'medium',
          direction: 'unidirectional'
        });
      }
    }
    
    // Detect bidirectional relationships
    for (const rel of relationships) {
      const reverse = relationships.find(r => 
        r.from === rel.to && r.to === rel.from
      );
      
      if (reverse) {
        rel.direction = 'bidirectional';
        rel.type = 'coupled';
      }
    }
    
  } catch (error) {
    console.error(`Error mapping component relationships: ${error.message}`);
  }
  
  return relationships;
}

/**
 * Calculate architectural metrics
 */
async function calculateArchitecturalMetrics(analysis) {
  const metrics = {
    complexity: 0,
    cohesion: 0,
    coupling: 0,
    modularity: 0,
    reusability: 0,
    testability: 0
  };
  
  try {
    // Calculate complexity based on component count and interconnections
    const componentCount = analysis.components.length;
    const relationshipCount = analysis.relationships.length;
    metrics.complexity = Math.min(1, (relationshipCount / Math.max(1, componentCount)) / 10);
    
    // Calculate cohesion (simplified - based on component size similarity)
    if (analysis.components.length > 0) {
      const sizes = analysis.components.map(c => c.size || 0);
      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length;
      metrics.cohesion = Math.max(0, 1 - (variance / Math.max(1, avgSize * avgSize)));
    }
    
    // Calculate coupling (based on dependency metrics)
    if (analysis.dependencies.metrics) {
      metrics.coupling = Math.min(1, analysis.dependencies.metrics.couplingCoefficient);
    }
    
    // Calculate modularity (based on component independence)
    const independentComponents = analysis.components.filter(c => 
      !analysis.relationships.some(r => r.from === c.name || r.to === c.name)
    ).length;
    metrics.modularity = componentCount > 0 ? independentComponents / componentCount : 0;
    
    // Calculate reusability (based on component interfaces)
    const componentsWithInterfaces = analysis.components.filter(c => 
      c.interfaces && c.interfaces.length > 0
    ).length;
    metrics.reusability = componentCount > 0 ? componentsWithInterfaces / componentCount : 0;
    
    // Calculate testability (based on component complexity)
    const simpleComponents = analysis.components.filter(c => 
      c.complexity && c.complexity.cyclomatic < 10
    ).length;
    metrics.testability = componentCount > 0 ? simpleComponents / componentCount : 0;
    
  } catch (error) {
    console.error(`Error calculating architectural metrics: ${error.message}`);
  }
  
  return metrics;
}

/**
 * Assess scalability
 */
async function assessScalability(analysis) {
  const scalability = {
    horizontal: 0,
    vertical: 0,
    database: 0,
    caching: 0,
    loadBalancing: 0,
    overall: 0
  };
  
  try {
    // Assess horizontal scalability (based on microservices pattern)
    const hasMicroservices = analysis.patterns.some(p => p.name === 'microservices');
    scalability.horizontal = hasMicroservices ? 0.8 : 0.3;
    
    // Assess vertical scalability (based on component modularity)
    scalability.vertical = analysis.metrics.modularity;
    
    // Assess database scalability (based on technology stack)
    const hasScalableDB = analysis.technologyStack.databases.some(db => 
      ['MongoDB', 'PostgreSQL', 'Redis'].includes(db)
    );
    scalability.database = hasScalableDB ? 0.7 : 0.4;
    
    // Assess caching (based on dependencies)
    const hasCaching = analysis.dependencies.external.some(dep => 
      ['redis', 'memcached'].includes(dep.name.toLowerCase())
    );
    scalability.caching = hasCaching ? 0.8 : 0.2;
    
    // Assess load balancing (based on configuration)
    const hasLoadBalancing = analysis.technologyStack.tools.some(tool => 
      tool.toLowerCase().includes('nginx') || tool.toLowerCase().includes('load balancer')
    );
    scalability.loadBalancing = hasLoadBalancing ? 0.7 : 0.3;
    
    // Calculate overall scalability
    scalability.overall = (scalability.horizontal + scalability.vertical + scalability.database + 
                          scalability.caching + scalability.loadBalancing) / 5;
    
  } catch (error) {
    console.error(`Error assessing scalability: ${error.message}`);
  }
  
  return scalability;
}

/**
 * Evaluate maintainability
 */
async function evaluateMaintainability(analysis) {
  const maintainability = {
    modularity: 0,
    testability: 0,
    understandability: 0,
    flexibility: 0,
    reusability: 0,
    overall: 0
  };
  
  try {
    // Evaluate modularity (based on component independence)
    maintainability.modularity = analysis.metrics.modularity;
    
    // Evaluate testability (based on component complexity)
    maintainability.testability = analysis.metrics.testability;
    
    // Evaluate understandability (based on pattern consistency)
    const hasConsistentPatterns = analysis.patterns.length > 0;
    maintainability.understandability = hasConsistentPatterns ? 0.7 : 0.4;
    
    // Evaluate flexibility (based on dependency patterns)
    const hasGoodDependencies = analysis.dependencies.patterns.length === 0;
    maintainability.flexibility = hasGoodDependencies ? 0.8 : 0.5;
    
    // Evaluate reusability (based on component interfaces)
    maintainability.reusability = analysis.metrics.reusability;
    
    // Calculate overall maintainability
    maintainability.overall = (maintainability.modularity + maintainability.testability + 
                              maintainability.understandability + maintainability.flexibility + 
                              maintainability.reusability) / 5;
    
  } catch (error) {
    console.error(`Error evaluating maintainability: ${error.message}`);
  }
  
  return maintainability;
}

/**
 * Generate architectural report
 */
async function generateArchitecturalReport(analysis, args) {
  const report = {
    summary: {
      project: analysis.project,
      timestamp: analysis.timestamp,
      patterns: analysis.patterns.length,
      components: analysis.components.length,
      dependencies: analysis.dependencies.external.length + analysis.dependencies.internal.length,
      issues: analysis.issues.length
    },
    patterns: analysis.patterns,
    technologyStack: analysis.technologyStack,
    metrics: analysis.metrics,
    scalability: analysis.scalability,
    maintainability: analysis.maintainability,
    issues: analysis.issues,
    detailedAnalysis: args.depth === 'detailed' ? {
      components: analysis.components.map(c => ({
        name: c.name,
        type: c.type,
        complexity: c.complexity,
        dependencies: c.dependencies?.length || 0,
        interfaces: c.interfaces?.length || 0
      })),
      dependencies: analysis.dependencies,
      relationships: analysis.relationships
    } : null
  };
  
  if (args.recommend) {
    report.recommendations = analysis.recommendations;
  }
  
  if (args.compare && analysis.comparison) {
    report.comparison = analysis.comparison;
  }
  
  return report;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report) {
  let markdown = `# Architectural Analysis Report\n\n`;
  
  // Summary
  markdown += `## Summary\n\n`;
  markdown += `- **Project**: ${report.summary.project}\n`;
  markdown += `- **Patterns Detected**: ${report.summary.patterns}\n`;
  markdown += `- **Components**: ${report.summary.components}\n`;
  markdown += `- **Dependencies**: ${report.summary.dependencies}\n`;
  markdown += `- **Issues**: ${report.summary.issues}\n\n`;
  
  // Patterns
  if (report.patterns.length > 0) {
    markdown += `## Architectural Patterns\n\n`;
    for (const pattern of report.patterns) {
      markdown += `### ${pattern.name.toUpperCase()}\n`;
      markdown += `- **Confidence**: ${Math.round(pattern.confidence * 100)}%\n`;
      markdown += `- **Description**: ${pattern.description}\n`;
      markdown += `- **Evidence**: ${pattern.evidence.join(', ')}\n\n`;
    }
  }
  
  // Technology Stack
  if (report.technologyStack.languages.length > 0) {
    markdown += `## Technology Stack\n\n`;
    markdown += `- **Languages**: ${report.technologyStack.languages.join(', ')}\n`;
    markdown += `- **Frameworks**: ${report.technologyStack.frameworks.join(', ')}\n`;
    markdown += `- **Databases**: ${report.technologyStack.databases.join(', ')}\n`;
    markdown += `- **Platforms**: ${report.technologyStack.platforms.join(', ')}\n\n`;
  }
  
  // Metrics
  markdown += `## Architectural Metrics\n\n`;
  markdown += `- **Complexity**: ${Math.round(report.metrics.complexity * 100)}%\n`;
  markdown += `- **Cohesion**: ${Math.round(report.metrics.cohesion * 100)}%\n`;
  markdown += `- **Coupling**: ${Math.round(report.metrics.coupling * 100)}%\n`;
  markdown += `- **Modularity**: ${Math.round(report.metrics.modularity * 100)}%\n`;
  markdown += `- **Reusability**: ${Math.round(report.metrics.reusability * 100)}%\n`;
  markdown += `- **Testability**: ${Math.round(report.metrics.testability * 100)}%\n\n`;
  
  // Scalability
  markdown += `## Scalability Assessment\n\n`;
  markdown += `- **Horizontal**: ${Math.round(report.scalability.horizontal * 100)}%\n`;
  markdown += `- **Vertical**: ${Math.round(report.scalability.vertical * 100)}%\n`;
  markdown += `- **Database**: ${Math.round(report.scalability.database * 100)}%\n`;
  markdown += `- **Caching**: ${Math.round(report.scalability.caching * 100)}%\n`;
  markdown += `- **Load Balancing**: ${Math.round(report.scalability.loadBalancing * 100)}%\n`;
  markdown += `- **Overall**: ${Math.round(report.scalability.overall * 100)}%\n\n`;
  
  // Maintainability
  markdown += `## Maintainability Assessment\n\n`;
  markdown += `- **Modularity**: ${Math.round(report.maintainability.modularity * 100)}%\n`;
  markdown += `- **Testability**: ${Math.round(report.maintainability.testability * 100)}%\n`;
  markdown += `- **Understandability**: ${Math.round(report.maintainability.understandability * 100)}%\n`;
  markdown += `- **Flexibility**: ${Math.round(report.maintainability.flexibility * 100)}%\n`;
  markdown += `- **Reusability**: ${Math.round(report.maintainability.reusability * 100)}%\n`;
  markdown += `- **Overall**: ${Math.round(report.maintainability.overall * 100)}%\n\n`;
  
  return markdown;
}

/**
 * Generate graph data for visualization
 */
function generateGraphData(report) {
  const nodes = [];
  const edges = [];
  
  // Add pattern nodes
  for (const pattern of report.patterns) {
    nodes.push({
      id: pattern.name,
      label: pattern.name.toUpperCase(),
      type: 'pattern',
      confidence: pattern.confidence
    });
  }
  
  // Add component nodes
  if (report.detailedAnalysis?.components) {
    for (const component of report.detailedAnalysis.components) {
      nodes.push({
        id: component.name,
        label: component.name,
        type: 'component',
        complexity: component.complexity.cyclomatic
      });
    }
  }
  
  // Add dependency edges
  if (report.detailedAnalysis?.relationships) {
    for (const rel of report.detailedAnalysis.relationships) {
      edges.push({
        from: rel.from,
        to: rel.to,
        type: rel.type,
        strength: rel.strength
      });
    }
  }
  
  return { nodes, edges };
}

/**
 * Save architectural results
 */
async function saveArchitecturalResults(projectPath, analysis, report, args) {
  try {
    const resultsDir = path.join(process.cwd(), '.claude', 'architectural-analysis');
    await fs.mkdir(resultsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const projectName = path.basename(projectPath);
    
    // Save JSON report
    const jsonFile = path.join(resultsDir, `${projectName}-${timestamp}.json`);
    await fs.writeFile(jsonFile, JSON.stringify(report, null, 2));
    
    // Save markdown report
    const mdFile = path.join(resultsDir, `${projectName}-${timestamp}.md`);
    await fs.writeFile(mdFile, generateMarkdownReport(report));
    
    // Save graph data if visualization requested
    if (args.visualize) {
      const graphFile = path.join(resultsDir, `${projectName}-${timestamp}-graph.json`);
      await fs.writeFile(graphFile, JSON.stringify(generateGraphData(report), null, 2));
    }
    
    console.error(`Architectural analysis results saved to ${resultsDir}`);
    
  } catch (error) {
    console.error(`Error saving architectural results: ${error.message}`);
  }
}

// Run the skill
main().catch(error => {
  console.error(`Skill failed: ${error.message}`);
  process.exit(1);
});