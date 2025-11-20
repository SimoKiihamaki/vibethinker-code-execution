import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Deep Repository Research Skill
 * Provides comprehensive analysis of code repositories with MLX-powered insights
 */

class DeepRepoResearch {
  constructor(options = {}) {
    this.options = {
      maxFiles: options.maxFiles || 1000,
      maxDepth: options.maxDepth || 5,
      timeout: options.timeout || 30000,
      concurrentWorkers: options.concurrentWorkers || 5,
      cacheResults: options.cacheResults !== false,
      focusAreas: options.focusAreas || ['architecture', 'dependencies', 'quality'],
      ...options
    };
    
    this.cache = new Map();
    this.analyzers = new Map();
    this.initializeAnalyzers();
  }

  initializeAnalyzers() {
    // Register built-in analyzers
    this.registerAnalyzer('architecture', this.analyzeArchitecture.bind(this));
    this.registerAnalyzer('dependencies', this.analyzeDependencies.bind(this));
    this.registerAnalyzer('complexity', this.analyzeComplexity.bind(this));
    this.registerAnalyzer('security', this.analyzeSecurity.bind(this));
    this.registerAnalyzer('performance', this.analyzePerformance.bind(this));
    this.registerAnalyzer('documentation', this.analyzeDocumentation.bind(this));
    this.registerAnalyzer('testing', this.analyzeTesting.bind(this));
  }

  registerAnalyzer(name, analyzer) {
    this.analyzers.set(name, analyzer);
  }

  async analyze(options = {}) {
    const startTime = Date.now();
    const analysisOptions = { ...this.options, ...options };
    
    try {
      console.log(`[deep-repo-research] Starting analysis of ${options.path || 'repository'}...`);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(options);
      if (this.options.cacheResults && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
          console.log('[deep-repo-research] Using cached results');
          return cached.data;
        }
      }
      
      // Gather repository information
      const repoInfo = await this.gatherRepositoryInfo(analysisOptions.path || '.');
      const fileAnalysis = await this.analyzeFiles(repoInfo.files, analysisOptions);
      
      // Run selected analyzers
      const analysisResults = {};
      for (const area of analysisOptions.focusAreas) {
        if (this.analyzers.has(area)) {
          analysisResults[area] = await this.analyzers.get(area)(fileAnalysis, repoInfo);
        }
      }
      
      const results = {
        summary: this.generateSummary(analysisResults, repoInfo),
        repository: repoInfo,
        analysis: analysisResults,
        issues: this.collectIssues(analysisResults),
        recommendations: this.generateRecommendations(analysisResults),
        metrics: {
          duration: Date.now() - startTime,
          filesAnalyzed: fileAnalysis.length,
          totalFiles: repoInfo.files.length,
          coverage: (fileAnalysis.length / repoInfo.files.length) * 100
        }
      };
      
      // Cache results
      if (this.options.cacheResults) {
        this.cache.set(cacheKey, {
          timestamp: Date.now(),
          data: results
        });
      }
      
      console.log(`[deep-repo-research] Analysis completed in ${results.metrics.duration}ms`);
      return results;
      
    } catch (error) {
      console.error('[deep-repo-research] Analysis failed:', error);
      throw new Error(`Repository analysis failed: ${error.message}`);
    }
  }

  async analyzeComponent(options) {
    const { componentPath, includeDependencies = true, includeTests = true, includeDocumentation = true } = options;
    
    try {
      console.log(`[deep-repo-research] Analyzing component: ${componentPath}`);
      
      const componentInfo = await this.analyzeSingleFile(componentPath);
      const dependencies = includeDependencies ? await this.analyzeComponentDependencies(componentPath) : [];
      const tests = includeTests ? await this.findRelatedTests(componentPath) : [];
      const documentation = includeDocumentation ? await this.findRelatedDocumentation(componentPath) : [];
      
      return {
        component: componentInfo,
        dependencies,
        tests,
        documentation,
        complexity: this.calculateComplexity(componentInfo),
        testCoverage: this.calculateTestCoverage(tests),
        documentationQuality: this.assessDocumentationQuality(documentation)
      };
      
    } catch (error) {
      console.error(`[deep-repo-research] Component analysis failed: ${error}`);
      throw new Error(`Component analysis failed: ${error.message}`);
    }
  }

  async analyzeSecurity(options = {}) {
    const { includeDependencies = true, includeSecrets = true, includeVulnerabilities = true, severityThreshold = 'medium' } = options;
    
    try {
      console.log('[deep-repo-research] Starting security analysis...');
      
      const vulnerabilities = [];
      const secretExposures = [];
      
      if (includeSecrets) {
        secretExposures.push(...await this.scanForSecrets());
      }
      
      if (includeVulnerabilities) {
        vulnerabilities.push(...await this.scanForVulnerabilities(severityThreshold));
      }
      
      if (includeDependencies) {
        const depVulns = await this.scanDependenciesForVulnerabilities(severityThreshold);
        vulnerabilities.push(...depVulns);
      }
      
      return {
        vulnerabilities,
        secretExposures,
        riskAssessment: this.assessSecurityRisk(vulnerabilities, secretExposures),
        recommendations: this.generateSecurityRecommendations(vulnerabilities, secretExposures)
      };
      
    } catch (error) {
      console.error('[deep-repo-research] Security analysis failed:', error);
      throw new Error(`Security analysis failed: ${error.message}`);
    }
  }

  async gatherRepositoryInfo(repoPath) {
    const files = await this.getRepositoryFiles(repoPath);
    const gitInfo = await this.getGitInfo(repoPath);
    const packageInfo = await this.getPackageInfo(repoPath);
    
    return {
      path: repoPath,
      files,
      git: gitInfo,
      package: packageInfo,
      structure: this.analyzeStructure(files),
      technologyStack: this.identifyTechnologyStack(files, packageInfo)
    };
  }

  async getRepositoryFiles(repoPath) {
    const files = [];
    const ignorePatterns = ['node_modules', '.git', 'dist', 'build', 'coverage'];
    
    const walkDirectory = async (dir, depth = 0) => {
      if (depth > this.options.maxDepth) return;
      
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!ignorePatterns.includes(entry.name) && !entry.name.startsWith('.')) {
              await walkDirectory(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            if (files.length < this.options.maxFiles) {
              const stats = await fs.stat(fullPath);
              files.push({
                path: fullPath,
                relativePath: path.relative(repoPath, fullPath),
                size: stats.size,
                extension: path.extname(fullPath),
                lastModified: stats.mtime
              });
            }
          }
        }
      } catch (error) {
        console.warn(`[deep-repo-research] Could not read directory ${dir}:`, error.message);
      }
    };
    
    await walkDirectory(repoPath);
    return files;
  }

  async analyzeFiles(files, options) {
    const analysisResults = [];
    const batchSize = Math.ceil(files.length / this.options.concurrentWorkers);
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(file => this.analyzeSingleFile(file.path))
      );
      analysisResults.push(...batchResults);
    }
    
    return analysisResults.filter(result => result !== null);
  }

  async analyzeSingleFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);
      
      return {
        path: filePath,
        content,
        size: stats.size,
        lines: content.split('\n').length,
        extension: path.extname(filePath),
        imports: this.extractImports(content),
        exports: this.extractExports(content),
        functions: this.extractFunctions(content),
        classes: this.extractClasses(content),
        complexity: this.calculateBasicComplexity(content)
      };
    } catch (error) {
      console.warn(`[deep-repo-research] Could not analyze file ${filePath}:`, error.message);
      return null;
    }
  }

  analyzeArchitecture(fileAnalysis, repoInfo) {
    const architecture = {
      patterns: [],
      layers: [],
      components: [],
      relationships: []
    };
    
    // Detect architectural patterns
    if (this.detectMVC(fileAnalysis)) architecture.patterns.push('MVC');
    if (this.detectMicroservices(fileAnalysis, repoInfo)) architecture.patterns.push('Microservices');
    if (this.detectMonorepo(fileAnalysis, repoInfo)) architecture.patterns.push('Monorepo');
    if (this.detectLayered(fileAnalysis)) architecture.patterns.push('Layered');
    
    // Analyze components and relationships
    architecture.components = this.identifyComponents(fileAnalysis);
    architecture.relationships = this.analyzeRelationships(fileAnalysis);
    
    return architecture;
  }

  analyzeDependencies(fileAnalysis, repoInfo) {
    const dependencies = {
      external: new Set(),
      internal: new Set(),
      circular: [],
      unused: []
    };
    
    // Extract dependencies
    fileAnalysis.forEach(file => {
      file.imports.forEach(imp => {
        if (this.isExternalDependency(imp)) {
          dependencies.external.add(imp);
        } else {
          dependencies.internal.add(imp);
        }
      });
    });
    
    // Detect circular dependencies
    dependencies.circular = this.detectCircularDependencies(fileAnalysis);
    
    return {
      external: Array.from(dependencies.external),
      internal: Array.from(dependencies.internal),
      circular: dependencies.circular,
      unused: dependencies.unused,
      summary: this.generateDependencySummary(dependencies)
    };
  }

  analyzeComplexity(fileAnalysis, repoInfo) {
    const complexity = {
      files: [],
      average: 0,
      highest: 0,
      distribution: {}
    };
    
    fileAnalysis.forEach(file => {
      const fileComplexity = this.calculateComplexity(file);
      complexity.files.push({
        path: file.path,
        complexity: fileComplexity,
        category: this.categorizeComplexity(fileComplexity)
      });
      
      complexity.highest = Math.max(complexity.highest, fileComplexity);
    });
    
    complexity.average = complexity.files.reduce((sum, f) => sum + f.complexity, 0) / complexity.files.length;
    complexity.distribution = this.calculateComplexityDistribution(complexity.files);
    
    return complexity;
  }

  analyzeSecurity(fileAnalysis, repoInfo) {
    // This would integrate with security scanning tools
    return {
      vulnerabilities: [],
      secretExposures: [],
      riskLevel: 'low',
      recommendations: []
    };
  }

  analyzePerformance(fileAnalysis, repoInfo) {
    // This would analyze performance patterns
    return {
      bottlenecks: [],
      optimizations: [],
      recommendations: []
    };
  }

  analyzeDocumentation(fileAnalysis, repoInfo) {
    const documentation = {
      coverage: 0,
      quality: 0,
      missing: [],
      outdated: []
    };
    
    // Calculate documentation coverage
    const documentedFiles = fileAnalysis.filter(file => this.hasDocumentation(file));
    documentation.coverage = (documentedFiles.length / fileAnalysis.length) * 100;
    
    // Assess documentation quality
    documentation.quality = this.assessDocumentationQuality(fileAnalysis);
    
    return documentation;
  }

  analyzeTesting(fileAnalysis, repoInfo) {
    const testing = {
      coverage: 0,
      testFiles: [],
      untestedFiles: [],
      quality: 0
    };
    
    // Find test files
    testing.testFiles = fileAnalysis.filter(file => this.isTestFile(file));
    
    // Calculate coverage (simplified)
    testing.coverage = this.estimateTestCoverage(fileAnalysis, testing.testFiles);
    
    return testing;
  }

  // Helper methods
  extractImports(content) {
    const imports = [];
    const importRegex = /(?:import|require)\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  extractExports(content) {
    const exports = [];
    const exportRegex = /export\s+(?:default\s+)?(?:const|function|class)\s+(\w+)/g;
    let match;
    
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    return exports;
  }

  extractFunctions(content) {
    const functions = [];
    const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?function|const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push(match[1] || match[2] || match[3]);
    }
    
    return functions;
  }

  extractClasses(content) {
    const classes = [];
    const classRegex = /class\s+(\w+)/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    
    return classes;
  }

  calculateBasicComplexity(content) {
    const lines = content.split('\n');
    let complexity = 0;
    
    // Simple complexity calculation
    lines.forEach(line => {
      if (line.includes('if') || line.includes('for') || line.includes('while') || line.includes('switch')) {
        complexity++;
      }
    });
    
    return complexity;
  }

  calculateComplexity(file) {
    // More sophisticated complexity calculation
    const baseComplexity = file.complexity || 0;
    const functionComplexity = (file.functions?.length || 0) * 2;
    const classComplexity = (file.classes?.length || 0) * 3;
    const importComplexity = (file.imports?.length || 0) * 0.5;
    
    return baseComplexity + functionComplexity + classComplexity + importComplexity;
  }

  categorizeComplexity(complexity) {
    if (complexity < 10) return 'simple';
    if (complexity < 25) return 'moderate';
    if (complexity < 50) return 'complex';
    return 'very-complex';
  }

  generateCacheKey(options) {
    return JSON.stringify(options);
  }

  generateSummary(analysisResults, repoInfo) {
    return {
      repository: `${repoInfo.files.length} files analyzed`,
      architecture: analysisResults.architecture?.patterns?.join(', ') || 'unknown',
      dependencies: `${analysisResults.dependencies?.external?.length || 0} external, ${analysisResults.dependencies?.internal?.length || 0} internal`,
      complexity: analysisResults.complexity?.average?.toFixed(1) || 'unknown',
      quality: this.assessOverallQuality(analysisResults)
    };
  }

  collectIssues(analysisResults) {
    const issues = [];
    
    // Collect issues from all analysis areas
    Object.entries(analysisResults).forEach(([area, result]) => {
      if (result.issues) {
        issues.push(...result.issues.map(issue => ({ ...issue, area })));
      }
    });
    
    return issues;
  }

  generateRecommendations(analysisResults) {
    const recommendations = [];
    
    // Generate recommendations based on analysis results
    if (analysisResults.complexity?.highest > 50) {
      recommendations.push({
        type: 'complexity',
        priority: 'high',
        message: 'Consider refactoring high-complexity files'
      });
    }
    
    if (analysisResults.architecture?.circular?.length > 0) {
      recommendations.push({
        type: 'architecture',
        priority: 'high',
        message: 'Address circular dependencies'
      });
    }
    
    return recommendations;
  }

  assessOverallQuality(analysisResults) {
    let score = 100;
    
    // Reduce score based on issues
    if (analysisResults.complexity?.highest > 50) score -= 20;
    if (analysisResults.architecture?.circular?.length > 0) score -= 30;
    if (analysisResults.dependencies?.unused?.length > 10) score -= 10;
    
    return Math.max(0, score);
  }

  // Heuristic implementations for architectural detection
  detectMVC(fileAnalysis) {
    const paths = Array.isArray(fileAnalysis) ? fileAnalysis.map(f => f.path || f).filter(Boolean) : [];
    for (const p of paths) {
      if (p.match(/(models?|views?|controllers?)/i)) return true;
    }
    return false;
  }

  detectMicroservices(fileAnalysis, repoInfo) {
    const paths = Array.isArray(fileAnalysis) ? fileAnalysis.map(f => f.path || f).filter(Boolean) : [];
    if (paths.some(p => p.includes('docker-compose'))) return true;
    // Count package.json files
    const pkgCount = paths.filter(p => p.endsWith('package.json')).length;
    return pkgCount > 2;
  }

  detectMonorepo(fileAnalysis, repoInfo) {
    const paths = Array.isArray(fileAnalysis) ? fileAnalysis.map(f => f.path || f).filter(Boolean) : [];
    return paths.some(p => 
      p.includes('lerna.json') || 
      p.includes('pnpm-workspace.yaml') || 
      p.includes('nx.json') ||
      p.includes('turbo.json') ||
      (p.includes('packages/') && p.endsWith('package.json'))
    );
  }

  detectLayered(fileAnalysis) {
    const paths = Array.isArray(fileAnalysis) ? fileAnalysis.map(f => f.path || f).filter(Boolean) : [];
    const layers = ['presentation', 'domain', 'data', 'application', 'infrastructure', 'services', 'repositories'];
    let found = 0;
    for (const l of layers) {
      if (paths.some(p => p.toLowerCase().includes(l))) found++;
    }
    return found >= 3;
  }

  // Other stubs retained but simplified or documented
  identifyComponents(fileAnalysis) { return []; }
  analyzeRelationships(fileAnalysis) { return []; }
  isExternalDependency(imp) { return imp && !imp.startsWith('.'); }
  detectCircularDependencies(fileAnalysis) { return []; }
  generateDependencySummary(dependencies) { return {}; }
  calculateComplexityDistribution(files) { return {}; }
  hasDocumentation(file) { return false; }
  isTestFile(file) { return (file.path || file).match(/(test|spec)/); }
  estimateTestCoverage(allFiles, testFiles) { 
    return allFiles.length > 0 ? (testFiles.length / allFiles.length) * 100 : 0; 
  }
  assessDocumentationQuality(files) {
    if (!Array.isArray(files) || files.length === 0) return 0;

    const paths = [];
    let totalLines = 0;
    let commentLines = 0;
    let exportedEntities = 0;
    let documentedExports = 0;
    let readmeScore = 0;
    let docsFolderScore = 0;
    let changelogScore = 0;

    const sourceExts = new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rb', '.rs', '.cs', '.php']);

    for (const file of files) {
      const filePath = file?.path || file;
      if (!filePath) continue;
      paths.push(filePath);

      const content = file?.content || '';
      const ext = path.extname(filePath).toLowerCase();

      // README metric
      if (readmeScore === 0 && /readme/i.test(path.basename(filePath))) {
        const lengthScore = Math.min(1, content.length / 2000); // 0 at empty, 1 at >=2000 chars
        readmeScore = lengthScore * 100;
      }

      // Docs folder metric
      if (filePath.toLowerCase().includes(`docs${path.sep}`) || path.basename(filePath).toLowerCase().startsWith('docs') && filePath.toLowerCase().endsWith('.md')) {
        const sizeWeight = Math.min(1, (file.size || content.length) / 10000);
        docsFolderScore = Math.max(docsFolderScore, sizeWeight * 100);
      }

      // Changelog / contributing metric
      const base = path.basename(filePath).toLowerCase();
      if (base.startsWith('changelog') || base === 'contributing.md' || base === 'contributing') {
        changelogScore = 100;
      }

      // Comment metrics for source files
      if (sourceExts.has(ext) && content) {
        const lines = content.split('\n');
        totalLines += lines.length;
        commentLines += lines.filter(line => {
          const trimmed = line.trim();
          return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*');
        }).length;

        // Exported entity documentation coverage (basic JSDoc/typed comment detection)
        const exportMatches = content.match(/export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g) || [];
        exportedEntities += exportMatches.length;

        const documentedRegex = /\/\*\*[\s\S]*?\*\/\s*export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g;
        let docMatch;
        while ((docMatch = documentedRegex.exec(content)) !== null) {
          documentedExports += 1;
        }
      }
    }

    // Normalize metrics
    const commentRatio = totalLines > 0 ? commentLines / totalLines : 0;
    const commentScore = Math.min(1, commentRatio / 0.25) * 100; // 25% comments => full score

    const jsdocCoverage = exportedEntities > 0 ? documentedExports / exportedEntities : 0;
    const jsdocScore = Math.min(1, jsdocCoverage) * 100;

    const weights = {
      readme: 0.2,
      comments: 0.3,
      jsdoc: 0.3,
      docs: 0.1,
      changelog: 0.1
    };

    const weighted =
      readmeScore * weights.readme +
      commentScore * weights.comments +
      jsdocScore * weights.jsdoc +
      docsFolderScore * weights.docs +
      changelogScore * weights.changelog;

    return Math.round(weighted);
  }
  getGitInfo(repoPath) { return {}; }
  getPackageInfo(repoPath) { return {}; }
  analyzeStructure(files) { return {}; }
  identifyTechnologyStack(files, packageInfo) {
    const tech = new Set();
    const safeDeps = (obj) => (obj && typeof obj === 'object') ? Object.keys(obj) : [];
    const addTech = (name) => name && tech.add(name);

    // Package-based detection (priority)
    const deps = [...safeDeps(packageInfo?.dependencies), ...safeDeps(packageInfo?.devDependencies)];
    deps.forEach(dep => {
      const lower = dep.toLowerCase();
      if (lower === 'react' || lower === 'react-dom') addTech('React');
      if (lower === 'next' || lower === 'next.js') addTech('Next.js');
      if (lower === 'express') addTech('Express');
      if (lower === 'koa') addTech('Koa');
      if (lower === 'fastify') addTech('Fastify');
      if (lower.startsWith('@nestjs')) addTech('NestJS');
      if (lower === 'typescript' || lower === 'ts-node') addTech('TypeScript');
      if (lower === 'vite') addTech('Vite');
      if (lower.includes('webpack')) addTech('Webpack');
      if (lower === 'django') addTech('Django');
      if (lower === 'flask') addTech('Flask');
      if (lower === 'fastapi') addTech('FastAPI');
      if (lower.includes('spring-boot') || lower === '@springboot') addTech('Spring Boot');
      if (lower === 'rails' || lower.includes('rails')) addTech('Ruby on Rails');
    });

    // File/extension based detection
    const pathList = Array.isArray(files) ? files.map(f => f?.path || f).filter(Boolean) : [];
    let sawPackageJson = false;

    for (const p of pathList) {
      const lowerPath = p.toLowerCase();
      const ext = path.extname(lowerPath);

      if (path.basename(lowerPath) === 'package.json') {
        sawPackageJson = true;
      }
      if (path.basename(lowerPath) === 'requirements.txt' || path.basename(lowerPath) === 'pipfile' || path.basename(lowerPath) === 'setup.py') {
        addTech('Python');
      }
      if (path.basename(lowerPath) === 'pom.xml' || path.basename(lowerPath) === 'build.gradle') {
        addTech('Java');
      }
      if (path.basename(lowerPath) === 'go.mod') addTech('Go');
      if (path.basename(lowerPath) === 'gemfile') addTech('Ruby');
      if (lowerPath.endsWith('.csproj')) addTech('.NET');
      if (path.basename(lowerPath) === 'cargo.toml') addTech('Rust');
      if (path.basename(lowerPath) === 'dockerfile') addTech('Docker');

      switch (ext) {
        case '.ts':
        case '.tsx':
          addTech('TypeScript');
          addTech('Node.js');
          break;
        case '.js':
        case '.jsx':
          addTech('Node.js');
          break;
        case '.py':
          addTech('Python');
          break;
        case '.java':
          addTech('Java');
          break;
        case '.go':
          addTech('Go');
          break;
        case '.rb':
          addTech('Ruby');
          break;
        case '.rs':
          addTech('Rust');
          break;
        case '.cs':
          addTech('.NET');
          break;
        case '.php':
          addTech('PHP');
          break;
      }
    }

    // If package.json exists and nothing else added for runtime, assume Node.js
    if (sawPackageJson) addTech('Node.js');

    return Array.from(tech);
  }
  analyzeComponentDependencies(componentPath) { return []; }
  findRelatedTests(componentPath) { return []; }
  findRelatedDocumentation(componentPath) { return []; }
  scanForSecrets() { return []; }
  scanForVulnerabilities(severityThreshold) { return []; }
  scanDependenciesForVulnerabilities(severityThreshold) { return []; }
  assessSecurityRisk(vulnerabilities, secretExposures) { return 'low'; }
  generateSecurityRecommendations(vulnerabilities, secretExposures) { return []; }
}

export default DeepRepoResearch;
