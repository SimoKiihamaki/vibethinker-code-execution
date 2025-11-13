#!/usr/bin/env node

/**
 * Session Start Hook for Claude Code
 * Initializes the development environment and context
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Main hook function that initializes session
 */
async function main() {
  try {
    console.error('🚀 SessionStart - Initializing MLX-Powered Agentic RAG System...');
    
    // Initialize session context
    const sessionContext = await initializeSessionContext();
    
    // Check system requirements
    const systemCheck = await checkSystemRequirements();
    
    // Initialize MLX backend
    const mlxStatus = await initializeMLXBackend();
    
    // Setup development environment
    const devEnvironment = await setupDevelopmentEnvironment();
    
    // Generate session summary
    const sessionSummary = {
      sessionId: generateSessionId(),
      timestamp: new Date().toISOString(),
      system: systemCheck,
      mlx: mlxStatus,
      environment: devEnvironment,
      context: sessionContext
    };
    
    // Save session information
    await saveSessionInfo(sessionSummary);
    
    console.error(`✅ Session initialization completed`);
    console.error(`   Session ID: ${sessionSummary.sessionId}`);
    console.error(`   MLX Status: ${mlxStatus.status}`);
    console.error(`   System Health: ${systemCheck.overall}`);
    
    // Output session summary
    const output = {
      session: sessionSummary,
      recommendations: generateStartupRecommendations(systemCheck, mlxStatus, devEnvironment),
      metadata: {
        initializedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    
    console.log(JSON.stringify(output));
    
  } catch (error) {
    console.error(`❌ Session initialization error: ${error.message}`);
    console.log(JSON.stringify({ 
      error: error.message,
      metadata: { timestamp: new Date().toISOString() }
    }));
    process.exit(1);
  }
}

/**
 * Initialize session context
 */
async function initializeSessionContext() {
  const context = {
    project: {},
    mlx: {},
    tools: {},
    history: []
  };
  
  try {
    // Analyze project structure
    context.project = await analyzeProjectStructure();
    
    // Check MLX configuration
    context.mlx = await checkMLXConfiguration();
    
    // Inventory available tools
    context.tools = await inventoryTools();
    
    // Load recent history
    context.history = await loadRecentHistory();
    
  } catch (error) {
    console.error(`Error initializing session context: ${error.message}`);
  }
  
  return context;
}

/**
 * Analyze project structure
 */
async function analyzeProjectStructure() {
  const project = {
    root: process.cwd(),
    type: 'unknown',
    languages: [],
    frameworks: [],
    testFrameworks: [],
    dependencies: {},
    structure: {}
  };
  
  try {
    // Check for package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      project.type = 'node';
      project.dependencies = packageJson.dependencies || {};
      project.devDependencies = packageJson.devDependencies || {};
      
      // Detect frameworks
      if (packageJson.dependencies?.react) project.frameworks.push('react');
      if (packageJson.dependencies?.vue) project.frameworks.push('vue');
      if (packageJson.dependencies?.express) project.frameworks.push('express');
      if (packageJson.dependencies?.['@nestjs/core']) project.frameworks.push('nestjs');
      
      // Detect test frameworks
      if (packageJson.devDependencies?.jest) project.testFrameworks.push('jest');
      if (packageJson.devDependencies?.mocha) project.testFrameworks.push('mocha');
      if (packageJson.devDependencies?.vitest) project.testFrameworks.push('vitest');
      
    } catch (error) {
      // No package.json
    }
    
    // Check for Python files
    const pyFiles = await findFilesByExtension('.py');
    if (pyFiles.length > 0) {
      project.type = 'python';
      project.languages.push('python');
      
      // Check for requirements.txt
      const requirementsPath = path.join(process.cwd(), 'requirements.txt');
      try {
        await fs.access(requirementsPath);
        project.hasRequirements = true;
      } catch (error) {
        project.hasRequirements = false;
      }
    }
    
    // Check for TypeScript
    const tsFiles = await findFilesByExtension('.ts');
    if (tsFiles.length > 0) {
      project.languages.push('typescript');
    }
    
    // Check for JavaScript
    const jsFiles = await findFilesByExtension('.js');
    if (jsFiles.length > 0) {
      project.languages.push('javascript');
    }
    
    // Analyze directory structure
    project.structure = await analyzeDirectoryStructure();
    
  } catch (error) {
    console.error(`Error analyzing project structure: ${error.message}`);
  }
  
  return project;
}

/**
 * Find files by extension
 */
async function findFilesByExtension(extension) {
  const files = [];
  
  try {
    const allFiles = await getAllFiles(process.cwd());
    return allFiles.filter(file => file.endsWith(extension));
  } catch (error) {
    console.error(`Error finding files with extension ${extension}: ${error.message}`);
    return files;
  }
}

/**
 * Get all files recursively
 */
async function getAllFiles(dir, files = []) {
  const items = await fs.readdir(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = await fs.stat(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      await getAllFiles(fullPath, files);
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Analyze directory structure
 */
async function analyzeDirectoryStructure() {
  const structure = {
    src: false,
    test: false,
    tests: false,
    __tests__: false,
    lib: false,
    dist: false,
    build: false,
    docs: false,
    config: false,
    .github: false,
    .vscode: false
  };
  
  try {
    const items = await fs.readdir(process.cwd());
    
    for (const item of items) {
      if (structure.hasOwnProperty(item)) {
        const stat = await fs.stat(path.join(process.cwd(), item));
        structure[item] = stat.isDirectory();
      }
    }
    
  } catch (error) {
    console.error(`Error analyzing directory structure: ${error.message}`);
  }
  
  return structure;
}

/**
 * Check MLX configuration
 */
async function checkMLXConfiguration() {
  const mlx = {
    configured: false,
    models: [],
    servers: [],
    loadBalancer: false,
    performance: {}
  };
  
  try {
    // Check for MLX server configuration
    const mlxConfigPath = path.join(process.cwd(), 'mlx-servers', 'config.json');
    try {
      const mlxConfig = JSON.parse(await fs.readFile(mlxConfigPath, 'utf8'));
      mlx.configured = true;
      mlx.models = mlxConfig.models || [];
      mlx.servers = mlxConfig.servers || [];
      mlx.loadBalancer = mlxConfig.loadBalancer || false;
    } catch (error) {
      // No MLX configuration
    }
    
    // Check for running MLX processes
    try {
      const processes = execSync('pgrep -f "mlx-server" || true', { encoding: 'utf8' });
      mlx.runningProcesses = processes.split('\n').filter(p => p.trim()).length;
    } catch (error) {
      mlx.runningProcesses = 0;
    }
    
  } catch (error) {
    console.error(`Error checking MLX configuration: ${error.message}`);
  }
  
  return mlx;
}

/**
 * Inventory available tools
 */
async function inventoryTools() {
  const tools = {
    mcp: false,
    claudeCode: false,
    hooks: [],
    skills: [],
    apis: []
  };
  
  try {
    // Check for MCP server
    const mcpPath = path.join(process.cwd(), 'mcp-server');
    try {
      await fs.access(mcpPath);
      tools.mcp = true;
    } catch (error) {
      // No MCP server
    }
    
    // Check for Claude Code hooks
    const hooksPath = path.join(process.cwd(), 'hooks');
    try {
      await fs.access(hooksPath);
      const hookFiles = await fs.readdir(hooksPath);
      tools.hooks = hookFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    } catch (error) {
      // No hooks directory
    }
    
    // Check for skills
    const skillsPath = path.join(process.cwd(), 'skills');
    try {
      await fs.access(skillsPath);
      const skillFiles = await fs.readdir(skillsPath);
      tools.skills = skillFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    } catch (error) {
      // No skills directory
    }
    
    // Check for APIs
    const apisPath = path.join(process.cwd(), 'apis');
    try {
      await fs.access(apisPath);
      const apiFiles = await fs.readdir(apisPath);
      tools.apis = apiFiles.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    } catch (error) {
      // No APIs directory
    }
    
  } catch (error) {
    console.error(`Error inventorying tools: ${error.message}`);
  }
  
  return tools;
}

/**
 * Load recent history
 */
async function loadRecentHistory() {
  const history = [];
  
  try {
    // Check for .claude directory
    const claudePath = path.join(process.cwd(), '.claude');
    try {
      await fs.access(claudePath);
      
      // Load recent analysis
      const analysisPath = path.join(claudePath, 'analysis');
      try {
        const analysisFiles = await fs.readdir(analysisPath);
        const recentAnalysis = analysisFiles
          .filter(f => f.endsWith('.json'))
          .slice(-5) // Last 5 analysis files
          .map(f => path.join(analysisPath, f));
        
        for (const file of recentAnalysis) {
          try {
            const data = JSON.parse(await fs.readFile(file, 'utf8'));
            history.push({
              type: 'analysis',
              timestamp: data.cachedAt,
              file: data.filePath
            });
          } catch (error) {
            // Skip invalid files
          }
        }
      } catch (error) {
        // No analysis directory
      }
      
      // Load recent test results
      const testResultsPath = path.join(claudePath, 'test-results');
      try {
        const testFiles = await fs.readdir(testResultsPath);
        const recentTests = testFiles
          .filter(f => f.endsWith('.json'))
          .slice(-5) // Last 5 test results
          .map(f => path.join(testResultsPath, f));
        
        for (const file of recentTests) {
          try {
            const data = JSON.parse(await fs.readFile(file, 'utf8'));
            history.push({
              type: 'test',
              timestamp: data.timestamp,
              file: data.filePath,
              success: data.success
            });
          } catch (error) {
            // Skip invalid files
          }
        }
      } catch (error) {
        // No test results directory
      }
      
    } catch (error) {
      // No .claude directory
    }
    
  } catch (error) {
    console.error(`Error loading recent history: ${error.message}`);
  }
  
  return history.slice(-10); // Keep last 10 items
}

/**
 * Check system requirements
 */
async function checkSystemRequirements() {
  const system = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    memory: process.memoryUsage(),
    overall: 'unknown',
    issues: []
  };
  
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 16) {
      system.issues.push('Node.js version should be 16 or higher');
    }
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.rss / 1024 / 1024;
    if (memoryMB > 1000) {
      system.issues.push('High memory usage detected');
    }
    
    // Check for required tools
    try {
      execSync('git --version', { stdio: 'ignore' });
    } catch (error) {
      system.issues.push('Git is not installed or not in PATH');
    }
    
    // Check for Python (needed for MLX)
    try {
      execSync('python3 --version', { stdio: 'ignore' });
    } catch (error) {
      try {
        execSync('python --version', { stdio: 'ignore' });
      } catch (pythonError) {
        system.issues.push('Python is not installed or not in PATH');
      }
    }
    
    // Determine overall health
    if (system.issues.length === 0) {
      system.overall = 'healthy';
    } else if (system.issues.length <= 2) {
      system.overall = 'warning';
    } else {
      system.overall = 'critical';
    }
    
  } catch (error) {
    console.error(`Error checking system requirements: ${error.message}`);
    system.issues.push('System check failed');
  }
  
  return system;
}

/**
 * Initialize MLX backend
 */
async function initializeMLXBackend() {
  const mlx = {
    status: 'unknown',
    instances: 0,
    loadBalancer: false,
    performance: {},
    issues: []
  };
  
  try {
    // Check if MLX servers are configured
    const mlxConfigPath = path.join(process.cwd(), 'mlx-servers', 'config.json');
    try {
      const mlxConfig = JSON.parse(await fs.readFile(mlxConfigPath, 'utf8'));
      mlx.instances = mlxConfig.servers?.length || 0;
      mlx.loadBalancer = mlxConfig.loadBalancer || false;
      
      // Try to start MLX servers if not running
      if (mlx.instances > 0) {
        const startResult = await startMLXServers();
        mlx.status = startResult.success ? 'running' : 'failed';
        mlx.issues.push(...startResult.issues);
      } else {
        mlx.status = 'not-configured';
      }
    } catch (error) {
      mlx.status = 'not-configured';
      mlx.issues.push('MLX servers not configured');
    }
    
    // Check MLX performance metrics
    mlx.performance = await checkMLXPerformance();
    
  } catch (error) {
    console.error(`Error initializing MLX backend: ${error.message}`);
    mlx.status = 'error';
    mlx.issues.push(`MLX initialization failed: ${error.message}`);
  }
  
  return mlx;
}

/**
 * Start MLX servers
 */
async function startMLXServers() {
  const result = {
    success: false,
    issues: []
  };
  
  try {
    // Check if server manager exists
    const serverManagerPath = path.join(process.cwd(), 'mlx-servers', 'server_manager.py');
    try {
      await fs.access(serverManagerPath);
      
      // Start servers using Python
      console.error('Starting MLX servers...');
      execSync('python3 mlx-servers/server_manager.py start', { stdio: 'ignore' });
      
      // Wait a moment for servers to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if servers are running
      const runningProcesses = execSync('pgrep -f "mlx-server" || true', { encoding: 'utf8' });
      const runningCount = runningProcesses.split('\n').filter(p => p.trim()).length;
      
      if (runningCount > 0) {
        result.success = true;
        console.error(`Started ${runningCount} MLX server instances`);
      } else {
        result.issues.push('MLX servers failed to start');
      }
      
    } catch (error) {
      result.issues.push('MLX server manager not found');
    }
    
  } catch (error) {
    result.issues.push(`Failed to start MLX servers: ${error.message}`);
  }
  
  return result;
}

/**
 * Check MLX performance
 */
async function checkMLXPerformance() {
  const performance = {
    memoryUsage: null,
    responseTime: null,
    throughput: null,
    lastHealthCheck: null
  };
  
  try {
    // Check if load balancer is running
    try {
      const healthResponse = execSync('curl -s http://localhost:8080/health || true', { encoding: 'utf8' });
      if (healthResponse) {
        const healthData = JSON.parse(healthResponse);
        performance.lastHealthCheck = healthData;
        performance.responseTime = healthData.responseTime;
        performance.throughput = healthData.throughput;
      }
    } catch (error) {
      // Load balancer not running
    }
    
    // Check memory usage of MLX processes
    try {
      const memoryInfo = execSync('ps aux | grep mlx-server | grep -v grep', { encoding: 'utf8' });
      const memoryMatch = memoryInfo.match(/\s+(\d+\.\d+)\s+\d+\.\d+\s+\d+\.\d+/);
      if (memoryMatch) {
        performance.memoryUsage = parseFloat(memoryMatch[1]);
      }
    } catch (error) {
      // MLX processes not running
    }
    
  } catch (error) {
    console.error(`Error checking MLX performance: ${error.message}`);
  }
  
  return performance;
}

/**
 * Setup development environment
 */
async function setupDevelopmentEnvironment() {
  const environment = {
    hooks: [],
    skills: [],
    apis: [],
    configuration: {},
    issues: []
  };
  
  try {
    // Setup Claude Code hooks
    environment.hooks = await setupHooks();
    
    // Setup skills
    environment.skills = await setupSkills();
    
    // Setup APIs
    environment.apis = await setupAPIs();
    
    // Check configuration
    environment.configuration = await checkConfiguration();
    
  } catch (error) {
    console.error(`Error setting up development environment: ${error.message}`);
    environment.issues.push(`Environment setup failed: ${error.message}`);
  }
  
  return environment;
}

/**
 * Setup hooks
 */
async function setupHooks() {
  const hooks = [];
  
  try {
    const hooksPath = path.join(process.cwd(), 'hooks');
    try {
      await fs.access(hooksPath);
      
      // Setup pre-tool-use hooks
      const preToolUsePath = path.join(hooksPath, 'pre-tool-use');
      try {
        const preHooks = await fs.readdir(preToolUsePath);
        for (const hook of preHooks) {
          if (hook.endsWith('.js')) {
            hooks.push(`pre-tool-use/${hook}`);
          }
        }
      } catch (error) {
        // No pre-tool-use directory
      }
      
      // Setup post-tool-use hooks
      const postToolUsePath = path.join(hooksPath, 'post-tool-use');
      try {
        const postHooks = await fs.readdir(postToolUsePath);
        for (const hook of postHooks) {
          if (hook.endsWith('.js')) {
            hooks.push(`post-tool-use/${hook}`);
          }
        }
      } catch (error) {
        // No post-tool-use directory
      }
      
    } catch (error) {
      // No hooks directory
    }
    
  } catch (error) {
    console.error(`Error setting up hooks: ${error.message}`);
  }
  
  return hooks;
}

/**
 * Setup skills
 */
async function setupSkills() {
  const skills = [];
  
  try {
    const skillsPath = path.join(process.cwd(), 'skills');
    try {
      await fs.access(skillsPath);
      
      const skillFiles = await fs.readdir(skillsPath);
      for (const skill of skillFiles) {
        if (skill.endsWith('.js') || skill.endsWith('.ts')) {
          skills.push(skill);
        }
      }
      
    } catch (error) {
      // No skills directory
    }
    
  } catch (error) {
    console.error(`Error setting up skills: ${error.message}`);
  }
  
  return skills;
}

/**
 * Setup APIs
 */
async function setupAPIs() {
  const apis = [];
  
  try {
    const apisPath = path.join(process.cwd(), 'apis');
    try {
      await fs.access(apisPath);
      
      const apiFiles = await fs.readdir(apisPath);
      for (const api of apiFiles) {
        if (api.endsWith('.js') || api.endsWith('.ts')) {
          apis.push(api);
        }
      }
      
    } catch (error) {
      // No APIs directory
    }
    
  } catch (error) {
    console.error(`Error setting up APIs: ${error.message}`);
  }
  
  return apis;
}

/**
 * Check configuration
 */
async function checkConfiguration() {
  const config = {
    mcp: false,
    mlx: false,
    claudeCode: false,
    issues: []
  };
  
  try {
    // Check MCP configuration
    const mcpConfigPath = path.join(process.cwd(), 'mcp-server', 'config.json');
    try {
      await fs.access(mcpConfigPath);
      config.mcp = true;
    } catch (error) {
      config.issues.push('MCP server not configured');
    }
    
    // Check MLX configuration
    const mlxConfigPath = path.join(process.cwd(), 'mlx-servers', 'config.json');
    try {
      await fs.access(mlxConfigPath);
      config.mlx = true;
    } catch (error) {
      config.issues.push('MLX servers not configured');
    }
    
    // Check Claude Code configuration
    const claudeConfigPath = path.join(process.cwd(), '.claude.json');
    try {
      await fs.access(claudeConfigPath);
      config.claudeCode = true;
    } catch (error) {
      config.issues.push('Claude Code not configured');
    }
    
  } catch (error) {
    console.error(`Error checking configuration: ${error.message}`);
  }
  
  return config;
}

/**
 * Generate session ID
 */
function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `session-${timestamp}-${random}`;
}

/**
 * Save session information
 */
async function saveSessionInfo(sessionSummary) {
  try {
    const sessionsDir = path.join(process.cwd(), '.claude', 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    
    const sessionFile = path.join(sessionsDir, `${sessionSummary.sessionId}.json`);
    await fs.writeFile(sessionFile, JSON.stringify(sessionSummary, null, 2));
    
    // Also save as current session
    const currentSessionFile = path.join(sessionsDir, 'current.json');
    await fs.writeFile(currentSessionFile, JSON.stringify(sessionSummary, null, 2));
    
  } catch (error) {
    console.error(`Error saving session info: ${error.message}`);
  }
}

/**
 * Generate startup recommendations
 */
function generateStartupRecommendations(systemCheck, mlxStatus, devEnvironment) {
  const recommendations = [];
  
  // System recommendations
  if (systemCheck.issues.length > 0) {
    recommendations.push('Address system issues before proceeding');
  }
  
  // MLX recommendations
  if (mlxStatus.status !== 'running') {
    recommendations.push('Start MLX servers for optimal performance');
  }
  
  if (mlxStatus.instances < 5) {
    recommendations.push('Consider increasing MLX server instances for better performance');
  }
  
  // Development environment recommendations
  if (devEnvironment.hooks.length === 0) {
    recommendations.push('Set up Claude Code hooks for automated workflows');
  }
  
  if (devEnvironment.skills.length === 0) {
    recommendations.push('Create skills for specialized tasks');
  }
  
  if (devEnvironment.configuration.issues.length > 0) {
    recommendations.push('Review and fix configuration issues');
  }
  
  return recommendations;
}

// Run the hook
main().catch(error => {
  console.error(`Hook failed: ${error.message}`);
  process.exit(1);
});