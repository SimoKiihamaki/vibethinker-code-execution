const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * PostToolUse hook that runs relevant tests after tool execution
 * This hook ensures code quality by running appropriate test suites
 */

class TestRunner {
  constructor() {
    this.testResults = [];
    this.coverageThreshold = 80; // Minimum coverage percentage
  }

  async run({ tool, result, context }) {
    try {
      console.log('[run-tests] Starting test execution...');
      
      const startTime = Date.now();
      const testSuites = await this.determineTestSuites(context);
      const testResults = await this.executeTests(testSuites);
      const coverageReport = await this.generateCoverageReport(testResults);
      
      const duration = Date.now() - startTime;
      const allPassed = testResults.every(result => result.success);
      
      console.log(`[run-tests] Test execution completed in ${duration}ms`);
      console.log(`[run-tests] ${testResults.length} test suites executed, ${allPassed ? 'all passed' : 'some failed'}`);
      
      return {
        success: allPassed,
        testSuites,
        testResults,
        coverageReport,
        duration,
        summary: {
          total: testResults.reduce((sum, r) => sum + r.total, 0),
          passed: testResults.reduce((sum, r) => sum + r.passed, 0),
          failed: testResults.reduce((sum, r) => sum + r.failed, 0),
          skipped: testResults.reduce((sum, r) => sum + r.skipped, 0)
        }
      };
    } catch (error) {
      console.error('[run-tests] Error running tests:', error);
      return {
        success: false,
        error: error.message,
        partialResults: true
      };
    }
  }

  async determineTestSuites(context) {
    const testSuites = [];
    
    try {
      // Analyze changed files to determine which tests to run
      const changedFiles = context.updatedFiles || [];
      const fileTypes = this.categorizeFiles(changedFiles);
      
      // Determine test types based on file changes
      if (fileTypes.javascript || fileTypes.typescript) {
        testSuites.push('unit');
      }
      
      if (fileTypes.react || fileTypes.vue) {
        testSuites.push('component');
      }
      
      if (fileTypes.api || fileTypes.backend) {
        testSuites.push('integration');
      }
      
      if (fileTypes.e2e || fileTypes.fullstack) {
        testSuites.push('e2e');
      }
      
      // Always run linting and type checking
      testSuites.push('lint');
      testSuites.push('typecheck');
      
      // Check for specific test frameworks in package.json
      const packageJson = await this.readPackageJson();
      const availableSuites = this.getAvailableTestSuites(packageJson);
      
      // Filter to only available suites
      const finalSuites = testSuites.filter(suite => availableSuites.includes(suite));
      
      // If no specific suites found, run default suite
      if (finalSuites.length === 0) {
        finalSuites.push('default');
      }
      
      console.log(`[run-tests] Determined test suites: ${finalSuites.join(', ')}`);
      
    } catch (error) {
      console.warn('[run-tests] Error determining test suites, using defaults:', error.message);
      return ['unit', 'lint', 'typecheck'];
    }
    
    return testSuites;
  }

  async executeTests(testSuites) {
    const results = [];
    
    for (const suite of testSuites) {
      try {
        console.log(`[run-tests] Executing ${suite} tests...`);
        
        const result = await this.runTestSuite(suite);
        results.push(result);
        
        console.log(`[run-tests] ${suite} tests: ${result.passed}/${result.total} passed`);
        
      } catch (error) {
        console.error(`[run-tests] Error executing ${suite} tests:`, error.message);
        results.push({
          suite,
          success: false,
          error: error.message,
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0
        });
      }
    }
    
    return results;
  }

  async runTestSuite(suite) {
    const startTime = Date.now();
    
    switch (suite) {
      case 'unit':
        return await this.runUnitTests(startTime);
      case 'component':
        return await this.runComponentTests(startTime);
      case 'integration':
        return await this.runIntegrationTests(startTime);
      case 'e2e':
        return await this.runE2ETests(startTime);
      case 'lint':
        return await this.runLinting(startTime);
      case 'typecheck':
        return await this.runTypeChecking(startTime);
      default:
        return await this.runDefaultTests(startTime);
    }
  }

  async runUnitTests(startTime) {
    const testCommands = [
      { cmd: 'npm', args: ['test', '--', '--watchAll=false', '--coverage'] },
      { cmd: 'npm', args: ['run', 'test:unit'] },
      { cmd: 'jest', args: ['--coverage', '--passWithNoTests'] },
      { cmd: 'vitest', args: ['run', '--coverage'] }
    ];
    
    return await this.tryTestCommands(testCommands, 'unit', startTime);
  }

  async runComponentTests(startTime) {
    const testCommands = [
      { cmd: 'npm', args: ['run', 'test:component'] },
      { cmd: 'npm', args: ['test', '--', '--testPathPattern=component'] },
      { cmd: 'cypress', args: ['run', '--component'] }
    ];
    
    return await this.tryTestCommands(testCommands, 'component', startTime);
  }

  async runIntegrationTests(startTime) {
    const testCommands = [
      { cmd: 'npm', args: ['run', 'test:integration'] },
      { cmd: 'npm', args: ['test', '--', '--testPathPattern=integration'] },
      { cmd: 'newman', args: ['run', 'tests/integration/postman.json'] }
    ];
    
    return await this.tryTestCommands(testCommands, 'integration', startTime);
  }

  async runE2ETests(startTime) {
    const testCommands = [
      { cmd: 'npm', args: ['run', 'test:e2e'] },
      { cmd: 'cypress', args: ['run'] },
      { cmd: 'playwright', args: ['test'] }
    ];
    
    return await this.tryTestCommands(testCommands, 'e2e', startTime);
  }

  async runLinting(startTime) {
    const lintCommands = [
      { cmd: 'npm', args: ['run', 'lint'] },
      { cmd: 'eslint', args: ['.', '--ext', '.js,.jsx,.ts,.tsx'] },
      { cmd: 'prettier', args: ['--check', '.'] }
    ];
    
    return await this.tryTestCommands(lintCommands, 'lint', startTime);
  }

  async runTypeChecking(startTime) {
    const typeCommands = [
      { cmd: 'npm', args: ['run', 'typecheck'] },
      { cmd: 'npm', args: ['run', 'tsc'] },
      { cmd: 'tsc', args: ['--noEmit'] }
    ];
    
    return await this.tryTestCommands(typeCommands, 'typecheck', startTime);
  }

  async runDefaultTests(startTime) {
    const defaultCommands = [
      { cmd: 'npm', args: ['test'] },
      { cmd: 'npm', args: ['run', 'check'] }
    ];
    
    return await this.tryTestCommands(defaultCommands, 'default', startTime);
  }

  async tryTestCommands(commands, suite, startTime) {
    for (const { cmd, args } of commands) {
      try {
        const result = await this.executeCommand(cmd, args);
        
        if (result.success || result.exitCode === 0) {
          return {
            suite,
            success: true,
            command: `${cmd} ${args.join(' ')}`,
            total: result.totalTests || 1,
            passed: result.success ? 1 : 0,
            failed: result.success ? 0 : 1,
            skipped: 0,
            duration: Date.now() - startTime,
            output: result.output,
            coverage: result.coverage
          };
        }
      } catch (error) {
        console.warn(`[run-tests] Command failed: ${cmd} ${args.join(' ')} - ${error.message}`);
        continue;
      }
    }
    
    // If all commands failed, return failure
    return {
      suite,
      success: false,
      error: 'All test commands failed',
      total: 0,
      passed: 0,
      failed: 1,
      skipped: 0,
      duration: Date.now() - startTime
    };
  }

  async executeCommand(cmd, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        stdio: 'pipe',
        shell: true
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        const output = stdout + stderr;
        const success = code === 0;
        
        // Parse test output for metrics
        const metrics = this.parseTestOutput(output);
        
        resolve({
          success,
          exitCode: code,
          output,
          ...metrics
        });
      });
      
      child.on('error', (error) => {
        reject(error);
      });
      
      // Timeout after 5 minutes
      setTimeout(() => {
        child.kill();
        reject(new Error('Test execution timed out'));
      }, 5 * 60 * 1000);
    });
  }

  parseTestOutput(output) {
    const metrics = {};
    
    // Parse Jest/Vitest output
    const jestMatch = output.match(/Tests:\s+(\d+)\s+passed.*?(\d+)\s+total/);
    if (jestMatch) {
      metrics.totalTests = parseInt(jestMatch[2]);
      metrics.passedTests = parseInt(jestMatch[1]);
    }
    
    // Parse coverage
    const coverageMatch = output.match(/All files\s+\|?\s+(\d+(?:\.\d+)?)/);
    if (coverageMatch) {
      metrics.coverage = parseFloat(coverageMatch[1]);
    }
    
    // Parse test count
    const testCountMatch = output.match(/(\d+)\s+tests?\s+passed/);
    if (testCountMatch) {
      metrics.totalTests = parseInt(testCountMatch[1]);
      metrics.passedTests = parseInt(testCountMatch[1]);
    }
    
    return metrics;
  }

  async generateCoverageReport(testResults) {
    const coverageResults = testResults.filter(r => r.coverage !== undefined);
    
    if (coverageResults.length === 0) {
      return {
        hasCoverage: false,
        message: 'No coverage data available'
      };
    }
    
    const averageCoverage = coverageResults.reduce((sum, r) => sum + r.coverage, 0) / coverageResults.length;
    const meetsThreshold = averageCoverage >= this.coverageThreshold;
    
    return {
      hasCoverage: true,
      averageCoverage: Math.round(averageCoverage * 10) / 10,
      threshold: this.coverageThreshold,
      meetsThreshold,
      details: coverageResults.map(r => ({
        suite: r.suite,
        coverage: r.coverage
      }))
    };
  }

  categorizeFiles(files) {
    const types = {
      javascript: false,
      typescript: false,
      react: false,
      vue: false,
      api: false,
      backend: false,
      e2e: false,
      fullstack: false
    };
    
    for (const file of files) {
      const path = file.path || file;
      
      if (path.endsWith('.js') || path.endsWith('.jsx')) {
        types.javascript = true;
      }
      if (path.endsWith('.ts') || path.endsWith('.tsx')) {
        types.typescript = true;
      }
      if (path.endsWith('.jsx') || path.endsWith('.tsx')) {
        types.react = true;
      }
      if (path.endsWith('.vue')) {
        types.vue = true;
      }
      if (path.includes('api/') || path.includes('server')) {
        types.api = true;
      }
      if (path.includes('backend') || path.includes('server')) {
        types.backend = true;
      }
      if (path.includes('e2e') || path.includes('cypress') || path.includes('playwright')) {
        types.e2e = true;
      }
      if (path.includes('fullstack') || path.includes('app')) {
        types.fullstack = true;
      }
    }
    
    return types;
  }

  async readPackageJson() {
    try {
      const content = await fs.readFile('package.json', 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  getAvailableTestSuites(packageJson) {
    const scripts = packageJson.scripts || {};
    const available = [];
    
    // Check for specific test scripts
    if (scripts.test) available.push('unit');
    if (scripts['test:unit']) available.push('unit');
    if (scripts['test:component']) available.push('component');
    if (scripts['test:integration']) available.push('integration');
    if (scripts['test:e2e']) available.push('e2e');
    if (scripts.lint) available.push('lint');
    if (scripts.typecheck) available.push('typecheck');
    if (scripts.tsc) available.push('typecheck');
    if (scripts.check) available.push('default');
    
    // Check for test frameworks in dependencies
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (deps.jest || deps.vitest) available.push('unit');
    if (deps.cypress) available.push('component', 'e2e');
    if (deps['@playwright/test']) available.push('e2e');
    if (deps.eslint || deps.prettier) available.push('lint');
    if (deps.typescript) available.push('typecheck');
    
    return [...new Set(available)]; // Remove duplicates
  }
}

// Export for use as Claude Code hook
module.exports = {
  name: 'run-tests',
  description: 'Runs relevant tests after tool execution to ensure code quality',
  trigger: 'PostToolUse',
  run: async (context) => {
    const runner = new TestRunner();
    return await runner.run(context);
  }
};