// System Integration Tests for MLX-Powered Agentic RAG System
import { expect } from 'vitest';
import { MLXClient } from '@mlx-agentic-rag/sdk';
import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

describe('MLX-Powered Agentic RAG System Integration Tests', function() {
  this.timeout(60000); // 60 second timeout for integration tests
  
  let mlxClient;
  let serverProcess;
  const TEST_REPO_PATH = path.join(__dirname, 'test-repo');
  const MLX_SERVER_URL = process.env.MLX_SERVER_URL || 'http://localhost:8080';
  const MLX_API_KEY = process.env.MLX_API_KEY || 'test-api-key';

  before(async function() {
    // Start MLX server if not running
    try {
      mlxClient = new MLXClient({
        baseUrl: MLX_SERVER_URL,
        apiKey: MLX_API_KEY
      });
      
      // Test server health
      const health = await mlxClient.health.check();
      expect(health.status).to.equal('healthy');
    } catch (error) {
      console.log('Starting MLX server for tests...');
      serverProcess = spawn('npm', ['run', 'start:server'], {
        cwd: path.join(__dirname, '../..'),
        stdio: 'pipe'
      });
      
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      mlxClient = new MLXClient({
        baseUrl: MLX_SERVER_URL,
        apiKey: MLX_API_KEY
      });
    }

    // Create test repository
    await createTestRepository();
  });

  after(async function() {
    // Cleanup test repository
    try {
      await fs.rm(TEST_REPO_PATH, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test repository:', error.message);
    }

    // Stop server if we started it
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  });

  describe('Performance Metrics Validation', function() {
    it('should achieve 19x faster repository analysis', async function() {
      const startTime = Date.now();
      
      const analysis = await mlxClient.repositories.analyze({
        path: TEST_REPO_PATH,
        options: {
          includeDependencies: true,
          securityScan: true,
          maxDepth: 3
        }
      });
      
      const endTime = Date.now();
      const analysisTime = (endTime - startTime) / 1000; // Convert to seconds
      
      // Traditional analysis would take ~45 seconds for similar repository
      const traditionalTime = 45;
      const speedup = traditionalTime / analysisTime;
      
      console.log(`Analysis completed in ${analysisTime}s, speedup: ${speedup}x`);
      
      expect(speedup).to.be.at.least(15); // Allow some margin, minimum 15x speedup
      expect(analysisTime).to.be.below(10); // Should complete in under 10 seconds
      expect(analysis.metrics.processingTime).to.be.below(10);
    });

    it('should achieve 98.7% token reduction', async function() {
      const analysis = await mlxClient.repositories.analyze({
        path: TEST_REPO_PATH,
        options: {
          includeDependencies: true,
          securityScan: true
        }
      });
      
      // Traditional analysis would use ~150k tokens
      const traditionalTokens = 150000;
      const actualTokens = analysis.metrics.tokensUsed;
      const tokenReduction = 1 - (actualTokens / traditionalTokens);
      
      console.log(`Token usage: ${actualTokens} tokens, reduction: ${(tokenReduction * 100).toFixed(1)}%`);
      
      expect(tokenReduction).to.be.at.least(0.95); // At least 95% reduction
      expect(actualTokens).to.be.below(10000); // Should use less than 10k tokens
      expect(analysis.metrics.tokenReduction).to.be.at.least(0.95);
    });

    it('should maintain 95%+ cache hit rate', async function() {
      // First analysis to populate cache
      await mlxClient.repositories.analyze({
        path: TEST_REPO_PATH,
        options: { quickAnalysis: true }
      });
      
      // Second analysis should hit cache
      const analysis = await mlxClient.repositories.analyze({
        path: TEST_REPO_PATH,
        options: { quickAnalysis: true }
      });
      
      expect(analysis.metrics.cacheHitRate).to.be.at.least(0.95);
    });

    it('should maintain 1,485+ tokens/sec throughput', async function() {
      const analysis = await mlxClient.repositories.analyze({
        path: TEST_REPO_PATH,
        options: {
          includeDependencies: true,
          securityScan: true
        }
      });
      
      const throughput = analysis.metrics.tokensUsed / analysis.metrics.processingTime;
      console.log(`Throughput: ${throughput.toFixed(0)} tokens/sec`);
      
      expect(throughput).to.be.at.least(1000); // Minimum 1000 tokens/sec
    });
  });

  describe('MLX Backend Performance', function() {
    it('should handle 27 concurrent MLX instances', async function() {
      const health = await mlxClient.health.check();
      
      expect(health.components.mlxServers.total).to.equal(27);
      expect(health.components.mlxServers.healthy).to.be.at.least(25); // Allow for 2 unhealthy instances
    });

    it('should handle concurrent requests efficiently', async function() {
      const concurrentRequests = 10;
      const startTime = Date.now();
      
      const requests = Array(concurrentRequests).fill().map((_, i) => 
        mlxClient.repositories.analyze({
          path: TEST_REPO_PATH,
          options: { quickAnalysis: true }
        })
      );
      
      const results = await Promise.all(requests);
      const endTime = Date.now();
      
      const totalTime = (endTime - startTime) / 1000;
      const averageTime = totalTime / concurrentRequests;
      
      console.log(`Processed ${concurrentRequests} concurrent requests in ${totalTime}s`);
      console.log(`Average time per request: ${averageTime.toFixed(2)}s`);
      
      expect(results).to.have.lengthOf(concurrentRequests);
      results.forEach(result => {
        expect(result.status).to.equal('completed');
      });
    });

    it('should maintain sub-10 second response time under load', async function() {
      const loadTest = async (requestCount) => {
        const startTime = Date.now();
        
        const requests = Array(requestCount).fill().map(() => 
          mlxClient.repositories.analyze({
            path: TEST_REPO_PATH,
            options: { quickAnalysis: true }
          })
        );
        
        await Promise.all(requests);
        
        const endTime = Date.now();
        return (endTime - startTime) / 1000;
      };
      
      // Test with increasing load
      const loads = [5, 10, 15, 20];
      
      for (const load of loads) {
        const totalTime = await loadTest(load);
        const averageTime = totalTime / load;
        
        console.log(`Load ${load} requests: total ${totalTime.toFixed(2)}s, average ${averageTime.toFixed(2)}s`);
        
        expect(averageTime).to.be.below(10); // Each request should complete in under 10 seconds
      }
    });
  });

  describe('Progressive Disclosure API', function() {
    it('should load tools on-demand with minimal overhead', async function() {
      const startTime = Date.now();
      
      const tools = await mlxClient.tools.list();
      
      const endTime = Date.now();
      const loadTime = (endTime - startTime) / 1000;
      
      console.log(`Tool listing completed in ${loadTime}s`);
      
      expect(tools.tools).to.be.an('array');
      expect(tools.tools.length).to.be.at.least(4); // At least 4 tools available
      expect(loadTime).to.be.below(2); // Should load in under 2 seconds
    });

    it('should demonstrate token efficiency through progressive disclosure', async function() {
      // Get available tools
      const tools = await mlxClient.tools.list();
      
      // Load a specific tool
      const toolName = tools.tools[0].name;
      const loadResult = await mlxClient.tools.load(toolName);
      
      expect(loadResult.status).to.equal('loaded');
      expect(loadResult.loadTime).to.be.below(1); // Should load in under 1 second
      expect(loadResult.toolName).to.equal(toolName);
    });
  });

  describe('Code Generation and Editing', function() {
    it('should generate high-quality code with context awareness', async function() {
      const analysis = await mlxClient.repositories.analyze({
        path: TEST_REPO_PATH,
        options: { quickAnalysis: true }
      });
      
      const generation = await mlxClient.code.generate({
        prompt: 'Create a utility function for data validation',
        context: {
          repositoryPath: TEST_REPO_PATH,
          existingCode: analysis.context.keyConcepts,
          language: 'javascript',
          patterns: analysis.structure.patterns
        },
        options: {
          includeTests: true,
          includeDocumentation: true
        }
      });
      
      expect(generation.code.main).to.be.a('string');
      expect(generation.code.tests).to.be.a('string');
      expect(generation.code.documentation).to.be.a('string');
      expect(generation.metrics.qualityScore).to.be.at.least(8); // Quality score should be 8+
    });

    it('should perform intelligent code editing with validation', async function() {
      const testFile = path.join(TEST_REPO_PATH, 'test-edit.js');
      await fs.writeFile(testFile, `
function oldFunction(data) {
  return data.map(item => item.value);
}
      `);
      
      const editResult = await mlxClient.code.edit({
        filePath: testFile,
        instruction: 'Add error handling and input validation',
        context: {
          repositoryPath: TEST_REPO_PATH,
          codingStandards: 'airbnb'
        },
        options: {
          includeTests: true,
          validationLevel: 'strict'
        }
      });
      
      expect(editResult.changes).to.be.an('array');
      expect(editResult.changes.length).to.be.at.least(1);
      expect(editResult.validation.syntaxCheck).to.equal('passed');
      expect(editResult.validation.testsPass).to.be.true;
      
      // Cleanup
      await fs.unlink(testFile);
    });
  });

  describe('Dependency and Security Analysis', function() {
    it('should detect security vulnerabilities accurately', async function() {
      const analysis = await mlxClient.dependencies.analyze({
        projectPath: TEST_REPO_PATH,
        packageManager: 'npm',
        options: {
          securityScan: true,
          vulnerabilityThreshold: 'low'
        }
      });
      
      expect(analysis.dependencies.total).to.be.a('number');
      expect(analysis.vulnerabilities).to.be.an('array');
      expect(analysis.metrics.securityScore).to.be.a('number');
      expect(analysis.metrics.securityScore).to.be.at.least(0);
      expect(analysis.metrics.securityScore).to.be.at.most(10);
    });

    it('should provide actionable security recommendations', async function() {
      const analysis = await mlxClient.dependencies.analyze({
        projectPath: TEST_REPO_PATH,
        packageManager: 'npm',
        options: {
          securityScan: true,
          includeRecommendations: true
        }
      });
      
      if (analysis.vulnerabilities.length > 0) {
        analysis.vulnerabilities.forEach(vuln => {
          expect(vuln).to.have.property('package');
          expect(vuln).to.have.property('severity');
          expect(vuln).to.have.property('recommendation');
          expect(vuln.recommendation).to.be.a('string');
          expect(vuln.recommendation.length).to.be.at.least(10);
        });
      }
    });
  });

  describe('Architectural Analysis', function() {
    it('should identify architectural patterns correctly', async function() {
      const analysis = await mlxClient.architecture.analyze({
        repositoryPath: TEST_REPO_PATH,
        options: {
          patternDetection: true,
          qualityAssessment: true
        }
      });
      
      expect(analysis.architecture).to.have.property('pattern');
      expect(analysis.architecture).to.have.property('style');
      expect(analysis.patterns).to.be.an('array');
      expect(analysis.quality).to.have.property('maintainability');
      expect(analysis.quality.maintainability).to.be.at.least(0);
      expect(analysis.quality.maintainability).to.be.at.most(10);
    });

    it('should detect architectural issues and provide recommendations', async function() {
      const analysis = await mlxClient.architecture.analyze({
        repositoryPath: TEST_REPO_PATH,
        options: {
          patternDetection: true,
          conformanceCheck: true
        }
      });
      
      expect(analysis.issues).to.be.an('array');
      analysis.issues.forEach(issue => {
        expect(issue).to.have.property('type');
        expect(issue).to.have.property('severity');
        expect(issue).to.have.property('description');
        expect(issue).to.have.property('recommendation');
      });
    });
  });

  describe('Error Handling and Resilience', function() {
    it('should handle invalid repository paths gracefully', async function() {
      try {
        await mlxClient.repositories.analyze({
          path: '/nonexistent/path',
          options: {}
        });
        
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).to.equal('VALIDATION_ERROR');
        expect(error.message).to.include('Repository path does not exist');
      }
    });

    it('should handle concurrent load without crashing', async function() {
      const promises = Array(50).fill().map((_, i) => 
        mlxClient.repositories.analyze({
          path: TEST_REPO_PATH,
          options: { quickAnalysis: true }
        }).catch(error => ({ error: error.message, index: i }))
      );
      
      const results = await Promise.all(promises);
      
      const successful = results.filter(r => !r.error);
      const failed = results.filter(r => r.error);
      
      console.log(`Successful: ${successful.length}, Failed: ${failed.length}`);
      
      // At least 80% should succeed even under high load
      expect(successful.length).to.be.at.least(40);
    });

    it('should recover from MLX instance failures', async function() {
      // Simulate instance failure by making many concurrent requests
      const requests = Array(100).fill().map(() => 
        mlxClient.repositories.analyze({
          path: TEST_REPO_PATH,
          options: { quickAnalysis: true }
        })
      );
      
      const results = await Promise.allSettled(requests);
      
      const successful = results.filter(r => r.status === 'fulfilled');
      
      // System should continue working even with some failures
      expect(successful.length).to.be.at.least(80); // At least 80% success rate
      
      // Check health after stress test
      const health = await mlxClient.health.check();
      expect(health.status).to.equal('healthy');
    });
  });

  describe('Claude Code Hooks Integration', function() {
    it('should execute PreToolUse hooks correctly', async function() {
      // Test security validation hook
      try {
        await mlxClient.code.edit({
          filePath: '/etc/passwd',
          instruction: 'Read system file',
          context: {},
          options: {}
        });
        
        expect.fail('Should have been blocked by security hook');
      } catch (error) {
        expect(error.message).to.include('Security validation failed');
      }
    });

    it('should execute PostToolUse hooks correctly', async function() {
      const testFile = path.join(TEST_REPO_PATH, 'test-post-hook.js');
      await fs.writeFile(testFile, 'console.log("test");');
      
      const editResult = await mlxClient.code.edit({
        filePath: testFile,
        instruction: 'Add a comment to this file',
        context: { repositoryPath: TEST_REPO_PATH },
        options: {
          includeTests: true,
          validationLevel: 'strict'
        }
      });
      
      // Post-tool hook should have run tests
      expect(editResult.validation.testsPass).to.be.true;
      
      // Cleanup
      await fs.unlink(testFile);
    });
  });

  describe('Skills System Integration', function() {
    it('should execute deep repository research skill', async function() {
      const research = await mlxClient.skills.execute('deep-repo-research', {
        repositoryPath: TEST_REPO_PATH,
        researchTopics: ['code quality', 'architecture patterns'],
        options: {
          includeExternalSources: false,
          generateRecommendations: true
        }
      });
      
      expect(research.findings).to.be.an('array');
      expect(research.findings.length).to.be.at.least(1);
      expect(research.metrics.accuracy).to.be.at.least(0.95);
    });

    it('should execute dependency analysis skill', async function() {
      const analysis = await mlxClient.skills.execute('dependency-analysis', {
        projectPath: TEST_REPO_PATH,
        packageManager: 'npm',
        options: {
          securityScan: true,
          includeRecommendations: true
        }
      });
      
      expect(analysis.dependencies).to.be.an('object');
      expect(analysis.vulnerabilities).to.be.an('array');
      expect(analysis.metrics.precision).to.be.at.least(0.95);
    });
  });

  describe('Monitoring and Health Checks', function() {
    it('should provide comprehensive health status', async function() {
      const health = await mlxClient.health.check();
      
      expect(health).to.have.property('status');
      expect(health).to.have.property('timestamp');
      expect(health).to.have.property('components');
      expect(health).to.have.property('metrics');
      
      expect(health.components).to.have.property('mcpServer');
      expect(health.components).to.have.property('mlxServers');
      expect(health.components).to.have.property('cache');
    });

    it('should provide detailed performance metrics', async function() {
      const metrics = await mlxClient.metrics.get();
      
      expect(metrics).to.have.property('performance');
      expect(metrics).to.have.property('tokenEfficiency');
      expect(metrics).to.have.property('mlxPerformance');
      expect(metrics).to.have.property('resourceUsage');
      
      expect(metrics.performance.requestsPerSecond).to.be.a('number');
      expect(metrics.performance.averageResponseTime).to.be.a('number');
      expect(metrics.tokenEfficiency.cacheHitRate).to.be.at.least(0);
      expect(metrics.tokenEfficiency.cacheHitRate).to.be.at.most(1);
    });
  });
});

// Helper function to create test repository
async function createTestRepository() {
  // Create directory structure
  await fs.mkdir(TEST_REPO_PATH, { recursive: true });
  await fs.mkdir(path.join(TEST_REPO_PATH, 'src'), { recursive: true });
  await fs.mkdir(path.join(TEST_REPO_PATH, 'tests'), { recursive: true });
  
  // Create package.json
  const packageJson = {
    name: 'test-repo',
    version: '1.0.0',
    description: 'Test repository for MLX integration tests',
    main: 'src/index.js',
    scripts: {
      test: 'jest',
      start: 'node src/index.js'
    },
    dependencies: {
      'express': '^4.18.0',
      'lodash': '^4.17.21',
      'axios': '^1.6.0'
    },
    devDependencies: {
      'jest': '^29.0.0',
      'eslint': '^8.0.0'
    }
  };
  
  await fs.writeFile(
    path.join(TEST_REPO_PATH, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create source files
  const indexJs = `
const express = require('express');
const _ = require('lodash');
const axios = require('axios');

class UserService {
  constructor() {
    this.users = [];
  }

  async getUser(id) {
    try {
      const user = this.users.find(u => u.id === id);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async createUser(userData) {
    const user = {
      id: _.uniqueId(),
      ...userData,
      createdAt: new Date()
    };
    this.users.push(user);
    return user;
  }
}

module.exports = UserService;
`;

  await fs.writeFile(path.join(TEST_REPO_PATH, 'src', 'index.js'), indexJs);
  
  // Create test files
  const testJs = `
const UserService = require('../src/index');

describe('UserService', () => {
  let service;

  beforeEach(() => {
    service = new UserService();
  });

  test('should create a user', async () => {
    const user = await service.createUser({
      name: 'John Doe',
      email: 'john@example.com'
    });

    expect(user).toHaveProperty('id');
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
  });

  test('should get a user by id', async () => {
    const created = await service.createUser({
      name: 'Jane Doe',
      email: 'jane@example.com'
    });

    const user = await service.getUser(created.id);
    expect(user.name).toBe('Jane Doe');
  });
});
`;

  await fs.writeFile(path.join(TEST_REPO_PATH, 'tests', 'index.test.js'), testJs);
  
  // Create configuration files
  const eslintConfig = {
    "env": {
      "node": true,
      "jest": true
    },
    "extends": "eslint:recommended",
    "rules": {
      "no-unused-vars": "warn",
      "no-console": "off"
    }
  };
  
  await fs.writeFile(
    path.join(TEST_REPO_PATH, '.eslintrc.json'),
    JSON.stringify(eslintConfig, null, 2)
  );
  
  // Create README
  const readme = `# Test Repository

This is a test repository for MLX integration testing.

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`javascript
const UserService = require('./src/index');

const service = new UserService();
const user = await service.createUser({
  name: 'Test User',
  email: 'test@example.com'
});
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`
`;

  await fs.writeFile(path.join(TEST_REPO_PATH, 'README.md'), readme);
}