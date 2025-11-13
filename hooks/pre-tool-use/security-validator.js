#!/usr/bin/env node

/**
 * Security Validator Hook for PreToolUse
 * Validates risky operations before execution
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Main hook function that validates operations
 */
async function main() {
  try {
    // Read input from stdin
    const input = JSON.parse(await readStdin());
    
    console.error('🔒 Security Validator - Checking operation...');
    
    // Extract tool information
    const { tool_name, tool_input } = input;
    
    // Check for dangerous operations
    const validationResult = await validateOperation(tool_name, tool_input);
    
    if (!validationResult.isValid) {
      console.error(`🚫 Security validation failed: ${validationResult.reason}`);
      
      // Output denial
      const output = {
        continue: false,
        stopReason: `Security validation failed: ${validationResult.reason}`,
        systemMessage: validationResult.suggestion || 'Operation blocked for security reasons'
      };
      
      console.log(JSON.stringify(output));
      process.exit(0);
    }
    
    // If warnings exist, add them to context
    if (validationResult.warnings.length > 0) {
      console.error(`⚠️  Security warnings: ${validationResult.warnings.join(', ')}`);
      
      const output = {
        context: {
          securityWarnings: validationResult.warnings,
          securityLevel: validationResult.securityLevel
        },
        continue: true
      };
      
      console.log(JSON.stringify(output));
    } else {
      // Operation is safe
      console.error('✅ Security validation passed');
      console.log(JSON.stringify({ continue: true }));
    }
    
  } catch (error) {
    console.error(`❌ Security validator error: ${error.message}`);
    // Fail safe - block the operation
    console.log(JSON.stringify({
      continue: false,
      stopReason: 'Security validation error',
      systemMessage: 'Operation blocked due to validation error'
    }));
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
 * Validate operation for security risks
 */
async function validateOperation(toolName, toolInput) {
  const result = {
    isValid: true,
    reason: '',
    warnings: [],
    securityLevel: 'low',
    suggestion: null
  };
  
  // Check for dangerous Bash commands
  if (toolName === 'Bash') {
    const command = extractCommand(toolInput);
    if (command) {
      const bashValidation = validateBashCommand(command);
      result.isValid = bashValidation.isValid;
      result.reason = bashValidation.reason;
      result.warnings = bashValidation.warnings;
      result.securityLevel = bashValidation.securityLevel;
      result.suggestion = bashValidation.suggestion;
    }
  }
  
  // Check for dangerous file operations
  if (toolName === 'Write' || toolName === 'Edit') {
    const filePath = extractFilePath(toolInput);
    if (filePath) {
      const fileValidation = await validateFileOperation(filePath, toolInput);
      if (!fileValidation.isValid) {
        result.isValid = false;
        result.reason = fileValidation.reason;
        result.suggestion = fileValidation.suggestion;
      }
      result.warnings.push(...fileValidation.warnings);
      result.securityLevel = Math.max(result.securityLevel, fileValidation.securityLevel);
    }
  }
  
  // Check for dangerous file deletions
  if (toolName === 'DeleteFile') {
    const filePath = extractFilePath(toolInput);
    if (filePath) {
      const deleteValidation = await validateDeleteOperation(filePath);
      if (!deleteValidation.isValid) {
        result.isValid = false;
        result.reason = deleteValidation.reason;
        result.suggestion = deleteValidation.suggestion;
      }
      result.warnings.push(...deleteValidation.warnings);
      result.securityLevel = Math.max(result.securityLevel, deleteValidation.securityLevel);
    }
  }
  
  // Check for sensitive data exposure
  const sensitiveValidation = validateSensitiveData(toolInput);
  if (sensitiveValidation.warnings.length > 0) {
    result.warnings.push(...sensitiveValidation.warnings);
    result.securityLevel = Math.max(result.securityLevel, sensitiveValidation.securityLevel);
  }
  
  return result;
}

/**
 * Extract command from tool input
 */
function extractCommand(toolInput) {
  if (typeof toolInput === 'string') {
    return toolInput;
  }
  
  if (typeof toolInput === 'object') {
    return toolInput.command || toolInput.cmd || toolInput.input || null;
  }
  
  return null;
}

/**
 * Extract file path from tool input
 */
function extractFilePath(toolInput) {
  if (typeof toolInput === 'string') {
    // Try to extract path from string
    const pathMatch = toolInput.match(/["']([^"']+\.(?:js|ts|jsx|tsx|py|java|cpp|c|h|hpp|md|json|yaml|yml|env|config))["']/);
    return pathMatch ? pathMatch[1] : null;
  }
  
  if (typeof toolInput === 'object') {
    return toolInput.file_path || toolInput.filePath || toolInput.path || toolInput.filename || null;
  }
  
  return null;
}

/**
 * Validate Bash command for security risks
 */
function validateBashCommand(command) {
  const result = {
    isValid: true,
    reason: '',
    warnings: [],
    securityLevel: 'low',
    suggestion: null
  };
  
  // Dangerous commands that should be blocked
  const dangerousCommands = [
    'rm -rf /',
    'rm -rf *',
    'format',
    'fdisk',
    'mkfs',
    'dd if=',
    ':(){ :|:& };:',
    'wget.*sh\s*\|',
    'curl.*sh\s*\|'
  ];
  
  for (const dangerous of dangerousCommands) {
    if (new RegExp(dangerous, 'i').test(command)) {
      result.isValid = false;
      result.reason = `Dangerous command detected: ${dangerous}`;
      result.securityLevel = 'critical';
      result.suggestion = 'This command could cause system damage. Please use a safer alternative.';
      return result;
    }
  }
  
  // Commands that require confirmation
  const riskyCommands = [
    'rm -rf',
    'sudo',
    'chmod 777',
    'chown -R',
    'kill -9',
    'pkill',
    'shutdown',
    'reboot'
  ];
  
  for (const risky of riskyCommands) {
    if (command.includes(risky)) {
      result.warnings.push(`Risky command detected: ${risky}`);
      result.securityLevel = 'high';
    }
  }
  
  // Network commands (potential data exfiltration)
  const networkCommands = ['curl', 'wget', 'scp', 'rsync', 'nc', 'telnet'];
  for (const network of networkCommands) {
    if (command.includes(network)) {
      result.warnings.push(`Network command detected: ${network}`);
      result.securityLevel = Math.max(result.securityLevel, 'medium');
    }
  }
  
  // Commands that modify system state
  const systemCommands = ['apt', 'yum', 'brew', 'npm install -g', 'pip install'];
  for (const system of systemCommands) {
    if (command.includes(system)) {
      result.warnings.push(`System modification command: ${system}`);
      result.securityLevel = Math.max(result.securityLevel, 'medium');
    }
  }
  
  return result;
}

/**
 * Validate file operation for security risks
 */
async function validateFileOperation(filePath, toolInput) {
  const result = {
    isValid: true,
    reason: '',
    warnings: [],
    securityLevel: 'low',
    suggestion: null
  };
  
  // Check for sensitive file paths
  const sensitivePaths = [
    '/etc/',
    '/usr/bin/',
    '/usr/sbin/',
    '/bin/',
    '/sbin/',
    '/boot/',
    '/dev/',
    '/proc/',
    '/sys/',
    '/root/',
    '.ssh/',
    '.gnupg/',
    '.env',
    'config.json',
    'secrets.json',
    'private.key',
    'id_rsa',
    '.aws/',
    '.docker/'
  ];
  
  for (const sensitive of sensitivePaths) {
    if (filePath.includes(sensitive)) {
      result.isValid = false;
      result.reason = `Sensitive file path detected: ${sensitive}`;
      result.securityLevel = 'critical';
      result.suggestion = 'Modifying system or sensitive files could cause security issues or system instability.';
      return result;
    }
  }
  
  // Check for configuration files
  const configExtensions = ['.conf', '.config', '.cfg', '.ini', '.toml'];
  const fileExt = path.extname(filePath).toLowerCase();
  
  if (configExtensions.includes(fileExt)) {
    result.warnings.push('Configuration file modification detected');
    result.securityLevel = 'high';
  }
  
  // Check for executable files
  const executableExtensions = ['.exe', '.sh', '.bat', '.cmd', '.app'];
  if (executableExtensions.includes(fileExt)) {
    result.warnings.push('Executable file modification detected');
    result.securityLevel = 'high';
  }
  
  // Check if file is in current project (safer) vs system directories
  const isInProject = !filePath.startsWith('/') || filePath.startsWith('./') || filePath.startsWith('../');
  
  if (!isInProject) {
    result.warnings.push('File outside project directory');
    result.securityLevel = Math.max(result.securityLevel, 'medium');
  }
  
  // Check file size (large files might be suspicious)
  try {
    const stats = await fs.stat(filePath);
    if (stats.size > 10 * 1024 * 1024) { // 10MB
      result.warnings.push('Large file detected (>10MB)');
      result.securityLevel = Math.max(result.securityLevel, 'medium');
    }
  } catch {
    // File doesn't exist yet (new file)
  }
  
  return result;
}

/**
 * Validate delete operation
 */
async function validateDeleteOperation(filePath) {
  const result = {
    isValid: true,
    reason: '',
    warnings: [],
    securityLevel: 'low',
    suggestion: null
  };
  
  // Critical files that should never be deleted
  const criticalFiles = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'tsconfig.json',
    '.gitignore',
    'README.md',
    'LICENSE',
    '.env.example',
    'docker-compose.yml',
    'Dockerfile'
  ];
  
  const fileName = path.basename(filePath);
  
  if (criticalFiles.includes(fileName)) {
    result.isValid = false;
    result.reason = `Critical file deletion detected: ${fileName}`;
    result.securityLevel = 'critical';
    result.suggestion = 'This file is critical for project operation and should not be deleted.';
    return result;
  }
  
  // Check if file is tracked by git
  try {
    execSync(`git ls-files --error-unmatch "${filePath}"`, { encoding: 'utf8', cwd: process.cwd() });
    result.warnings.push('File is tracked by git');
    result.securityLevel = 'medium';
  } catch {
    // File is not tracked by git (untracked or new)
  }
  
  // Check if file is in node_modules or other system directories
  if (filePath.includes('node_modules') || filePath.includes('.git')) {
    result.isValid = false;
    result.reason = 'Attempting to delete system or dependency files';
    result.securityLevel = 'high';
    result.suggestion = 'These files are managed by package managers or version control and should not be manually deleted.';
    return result;
  }
  
  return result;
}

/**
 * Validate for sensitive data exposure
 */
function validateSensitiveData(toolInput) {
  const result = {
    warnings: [],
    securityLevel: 'low'
  };
  
  const inputStr = JSON.stringify(toolInput);
  
  // Check for API keys
  const apiKeyPatterns = [
    /['"]api[_-]?key['"]\s*:\s*['"][a-zA-Z0-9]{20,}['"]/i,
    /['"]sk-[a-zA-Z0-9]{20,}['"]/,
    /['"]Bearer\s+[a-zA-Z0-9]{20,}['"]/i
  ];
  
  for (const pattern of apiKeyPatterns) {
    if (pattern.test(inputStr)) {
      result.warnings.push('Potential API key detected');
      result.securityLevel = 'high';
      break;
    }
  }
  
  // Check for passwords
  const passwordPatterns = [
    /['"]password['"]\s*:\s*['"][^'"]{8,}['"]/i,
    /['"]pwd['"]\s*:\s*['"][^'"]{8,}['"]/i,
    /['"]pass['"]\s*:\s*['"][^'"]{8,}['"]/i
  ];
  
  for (const pattern of passwordPatterns) {
    if (pattern.test(inputStr)) {
      result.warnings.push('Potential password detected');
      result.securityLevel = 'high';
      break;
    }
  }
  
  // Check for email addresses
  const emailPattern = /['"][a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}['"]/;
  if (emailPattern.test(inputStr)) {
    result.warnings.push('Email address detected');
    result.securityLevel = Math.max(result.securityLevel, 'medium');
  }
  
  return result;
}

// Run the hook
main().catch(error => {
  console.error(`Hook failed: ${error.message}`);
  // Fail safe - block the operation
  console.log(JSON.stringify({
    continue: false,
    stopReason: 'Security validation error',
    systemMessage: 'Operation blocked due to validation error'
  }));
});