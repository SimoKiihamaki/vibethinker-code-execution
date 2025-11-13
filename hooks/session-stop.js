#!/usr/bin/env node

/**
 * Session Stop Hook for Claude Code
 * Cleanup and summary generation for session end
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Main hook function that handles session cleanup
 */
async function main() {
  try {
    console.error('🛑 SessionStop - Cleaning up MLX-Powered Agentic RAG System...');
    
    // Load current session
    const sessionInfo = await loadCurrentSession();
    
    // Generate session summary
    const sessionSummary = await generateSessionSummary(sessionInfo);
    
    // Cleanup resources
    const cleanupResults = await cleanupResources();
    
    // Generate final report
    const finalReport = await generateFinalReport(sessionSummary, cleanupResults);
    
    // Save session summary
    await saveSessionSummary(sessionSummary, finalReport);
    
    console.error(`✅ Session cleanup completed`);
    console.error(`   Session duration: ${sessionSummary.duration}`);
    console.error(`   Tools executed: ${sessionSummary.toolsExecuted}`);
    console.error(`   MLX operations: ${sessionSummary.mlxOperations}`);
    
    // Output final summary
    const output = {
      session: sessionSummary,
      cleanup: cleanupResults,
      report: finalReport,
      metadata: {
        stoppedAt: new Date().toISOString(),
        sessionId: sessionInfo?.sessionId || 'unknown'
      }
    };
    
    console.log(JSON.stringify(output));
    
  } catch (error) {
    console.error(`❌ Session cleanup error: ${error.message}`);
    console.log(JSON.stringify({ 
      error: error.message,
      metadata: { timestamp: new Date().toISOString() }
    }));
    process.exit(1);
  }
}

/**
 * Load current session information
 */
async function loadCurrentSession() {
  try {
    const currentSessionPath = path.join(process.cwd(), '.claude', 'sessions', 'current.json');
    const sessionData = JSON.parse(await fs.readFile(currentSessionPath, 'utf8'));
    return sessionData;
  } catch (error) {
    console.error(`Error loading current session: ${error.message}`);
    return {
      sessionId: 'unknown',
      timestamp: new Date().toISOString(),
      system: {},
      mlx: {},
      environment: {}
    };
  }
}

/**
 * Generate session summary
 */
async function generateSessionSummary(sessionInfo) {
  const summary = {
    sessionId: sessionInfo.sessionId,
    startTime: sessionInfo.timestamp,
    endTime: new Date().toISOString(),
    duration: '',
    toolsExecuted: 0,
    mlxOperations: 0,
    filesModified: 0,
    testsRun: 0,
    errors: 0,
    warnings: 0,
    performance: {},
    recommendations: []
  };
  
  try {
    // Calculate duration
    const startTime = new Date(sessionInfo.timestamp);
    const endTime = new Date(summary.endTime);
    const durationMs = endTime - startTime;
    summary.duration = formatDuration(durationMs);
    
    // Analyze session activity
    const activity = await analyzeSessionActivity();
    summary.toolsExecuted = activity.toolsExecuted;
    summary.mlxOperations = activity.mlxOperations;
    summary.filesModified = activity.filesModified;
    summary.testsRun = activity.testsRun;
    summary.errors = activity.errors;
    summary.warnings = activity.warnings;
    
    // Get performance metrics
    summary.performance = await getPerformanceMetrics();
    
    // Generate recommendations
    summary.recommendations = await generateSessionRecommendations(summary, activity);
    
  } catch (error) {
    console.error(`Error generating session summary: ${error.message}`);
  }
  
  return summary;
}

/**
 * Format duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Analyze session activity
 */
async function analyzeSessionActivity() {
  const activity = {
    toolsExecuted: 0,
    mlxOperations: 0,
    filesModified: 0,
    testsRun: 0,
    errors: 0,
    warnings: 0
  };
  
  try {
    const claudePath = path.join(process.cwd(), '.claude');
    
    // Count tool executions from analysis files
    try {
      const analysisPath = path.join(claudePath, 'analysis');
      const analysisFiles = await fs.readdir(analysisPath);
      activity.toolsExecuted = analysisFiles.length;
    } catch (error) {
      // No analysis directory
    }
    
    // Count MLX operations from logs
    try {
      const logsPath = path.join(claudePath, 'logs');
      const logFiles = await fs.readdir(logsPath);
      
      for (const logFile of logFiles) {
        if (logFile.includes('mlx')) {
          const logContent = await fs.readFile(path.join(logsPath, logFile), 'utf8');
          const mlxMatches = logContent.match(/MLX operation/gi);
          if (mlxMatches) {
            activity.mlxOperations += mlxMatches.length;
          }
        }
      }
    } catch (error) {
      // No logs directory
    }
    
    // Count file modifications from context updates
    try {
      const updatesPath = path.join(claudePath, 'updates');
      const updateFiles = await fs.readdir(updatesPath);
      activity.filesModified = updateFiles.length;
    } catch (error) {
      // No updates directory
    }
    
    // Count test runs
    try {
      const testResultsPath = path.join(claudePath, 'test-results');
      const testFiles = await fs.readdir(testResultsPath);
      activity.testsRun = testFiles.length;
      
      // Count errors and warnings from test results
      for (const testFile of testFiles) {
        const testData = JSON.parse(await fs.readFile(path.join(testResultsPath, testFile), 'utf8'));
        if (testData.testResults && testData.testResults.failed > 0) {
          activity.errors += testData.testResults.failed;
        }
      }
    } catch (error) {
      // No test results directory
    }
    
    // Count warnings from analysis files
    try {
      const analysisPath = path.join(claudePath, 'analysis');
      const analysisFiles = await fs.readdir(analysisPath);
      
      for (const analysisFile of analysisFiles) {
        const analysisData = JSON.parse(await fs.readFile(path.join(analysisPath, analysisFile), 'utf8'));
        if (analysisData.analysis && analysisData.analysis.issues) {
          activity.warnings += analysisData.analysis.issues.length;
        }
      }
    } catch (error) {
      // No analysis directory
    }
    
  } catch (error) {
    console.error(`Error analyzing session activity: ${error.message}`);
  }
  
  return activity;
}

/**
 * Get performance metrics
 */
async function getPerformanceMetrics() {
  const metrics = {
    averageResponseTime: null,
    memoryUsage: null,
    cpuUsage: null,
    mlxThroughput: null
  };
  
  try {
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    metrics.memoryUsage = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024) // MB
    };
    
    // Get MLX throughput from logs
    try {
      const logsPath = path.join(process.cwd(), '.claude', 'logs');
      const logFiles = await fs.readdir(logsPath);
      
      let totalThroughput = 0;
      let throughputCount = 0;
      
      for (const logFile of logFiles) {
        if (logFile.includes('mlx')) {
          const logContent = await fs.readFile(path.join(logsPath, logFile), 'utf8');
          const throughputMatches = logContent.match(/throughput[:\s]+(\d+(?:\.\d+)?)/gi);
          if (throughputMatches) {
            for (const match of throughputMatches) {
              const value = parseFloat(match.match(/(\d+(?:\.\d+)?)/)[1]);
              totalThroughput += value;
              throughputCount++;
            }
          }
        }
      }
      
      if (throughputCount > 0) {
        metrics.mlxThroughput = Math.round(totalThroughput / throughputCount);
      }
    } catch (error) {
      // No logs directory or MLX logs
    }
    
  } catch (error) {
    console.error(`Error getting performance metrics: ${error.message}`);
  }
  
  return metrics;
}

/**
 * Generate session recommendations
 */
async function generateSessionRecommendations(summary, activity) {
  const recommendations = [];
  
  // Performance recommendations
  if (activity.errors > 0) {
    recommendations.push('Review and fix errors from this session');
  }
  
  if (activity.warnings > 5) {
    recommendations.push('Address warnings to improve code quality');
  }
  
  if (activity.testsRun === 0 && activity.filesModified > 0) {
    recommendations.push('Consider adding tests for modified files');
  }
  
  if (activity.mlxOperations < 10 && activity.toolsExecuted > 20) {
    recommendations.push('MLX system was underutilized - consider more MLX operations');
  }
  
  // Resource recommendations
  if (summary.performance.memoryUsage && summary.performance.memoryUsage.heapUsed > 500) {
    recommendations.push('High memory usage detected - consider memory optimization');
  }
  
  return recommendations;
}

/**
 * Cleanup resources
 */
async function cleanupResources() {
  const cleanup = {
    mlxServers: false,
    temporaryFiles: 0,
    cacheCleared: false,
    logsArchived: false,
    issues: []
  };
  
  try {
    // Stop MLX servers
    try {
      execSync('python3 mlx-servers/server_manager.py stop', { stdio: 'ignore' });
      cleanup.mlxServers = true;
      console.error('MLX servers stopped');
    } catch (error) {
      cleanup.issues.push(`Failed to stop MLX servers: ${error.message}`);
    }
    
    // Clean up temporary files
    try {
      const tempFiles = await cleanupTemporaryFiles();
      cleanup.temporaryFiles = tempFiles;
      console.error(`Cleaned up ${tempFiles} temporary files`);
    } catch (error) {
      cleanup.issues.push(`Failed to clean temporary files: ${error.message}`);
    }
    
    // Archive logs
    try {
      await archiveLogs();
      cleanup.logsArchived = true;
      console.error('Logs archived');
    } catch (error) {
      cleanup.issues.push(`Failed to archive logs: ${error.message}`);
    }
    
    // Clear old cache entries
    try {
      await clearOldCache();
      cleanup.cacheCleared = true;
      console.error('Old cache entries cleared');
    } catch (error) {
      cleanup.issues.push(`Failed to clear cache: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`Error during cleanup: ${error.message}`);
    cleanup.issues.push(`Cleanup failed: ${error.message}`);
  }
  
  return cleanup;
}

/**
 * Cleanup temporary files
 */
async function cleanupTemporaryFiles() {
  let count = 0;
  
  try {
    // Clean up temporary test result files
    const tempFiles = [
      '/tmp/jest-results.json',
      '/tmp/vitest-results.json',
      '/tmp/pytest-results.json'
    ];
    
    for (const tempFile of tempFiles) {
      try {
        await fs.unlink(tempFile);
        count++;
      } catch (error) {
        // File doesn't exist, continue
      }
    }
    
    // Clean up old analysis files (older than 7 days)
    const analysisPath = path.join(process.cwd(), '.claude', 'analysis');
    try {
      const analysisFiles = await fs.readdir(analysisPath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      
      for (const file of analysisFiles) {
        const filePath = path.join(analysisPath, file);
        const stat = await fs.stat(filePath);
        
        if (stat.mtime < cutoffDate) {
          await fs.unlink(filePath);
          count++;
        }
      }
    } catch (error) {
      // No analysis directory
    }
    
  } catch (error) {
    console.error(`Error cleaning temporary files: ${error.message}`);
  }
  
  return count;
}

/**
 * Archive logs
 */
async function archiveLogs() {
  try {
    const logsPath = path.join(process.cwd(), '.claude', 'logs');
    const archivePath = path.join(process.cwd(), '.claude', 'logs-archive');
    
    await fs.mkdir(archivePath, { recursive: true });
    
    const logFiles = await fs.readdir(logsPath);
    const timestamp = new Date().toISOString().split('T')[0];
    
    for (const logFile of logFiles) {
      if (logFile.endsWith('.log')) {
        const sourcePath = path.join(logsPath, logFile);
        const archiveFile = `${timestamp}-${logFile}`;
        const destPath = path.join(archivePath, archiveFile);
        
        await fs.copyFile(sourcePath, destPath);
        await fs.unlink(sourcePath);
      }
    }
    
  } catch (error) {
    console.error(`Error archiving logs: ${error.message}`);
    throw error;
  }
}

/**
 * Clear old cache entries
 */
async function clearOldCache() {
  try {
    const cachePath = path.join(process.cwd(), '.claude', 'cache');
    
    try {
      const cacheFiles = await fs.readdir(cachePath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 3); // Clear cache older than 3 days
      
      for (const file of cacheFiles) {
        const filePath = path.join(cachePath, file);
        const stat = await fs.stat(filePath);
        
        if (stat.mtime < cutoffDate) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      // No cache directory
    }
    
  } catch (error) {
    console.error(`Error clearing cache: ${error.message}`);
    throw error;
  }
}

/**
 * Generate final report
 */
async function generateFinalReport(sessionSummary, cleanupResults) {
  const report = {
    summary: {
      sessionDuration: sessionSummary.duration,
      totalOperations: sessionSummary.toolsExecuted + sessionSummary.mlxOperations,
      successRate: calculateSuccessRate(sessionSummary),
      performance: sessionSummary.performance
    },
    recommendations: [],
    nextSteps: []
  };
  
  // Generate recommendations based on session
  if (sessionSummary.errors > 0) {
    report.recommendations.push('Review error logs and fix issues before next session');
  }
  
  if (sessionSummary.performance.mlxThroughput && sessionSummary.performance.mlxThroughput < 1000) {
    report.recommendations.push('Consider optimizing MLX performance for better throughput');
  }
  
  if (cleanupResults.issues.length > 0) {
    report.recommendations.push('Review cleanup issues for next session');
  }
  
  // Generate next steps
  report.nextSteps.push('Review session summary and performance metrics');
  
  if (sessionSummary.filesModified > 0) {
    report.nextSteps.push('Commit changes to version control');
  }
  
  if (sessionSummary.testsRun === 0 && sessionSummary.filesModified > 0) {
    report.nextSteps.push('Add tests for modified files');
  }
  
  return report;
}

/**
 * Calculate success rate
 */
function calculateSuccessRate(summary) {
  const total = summary.toolsExecuted + summary.mlxOperations;
  const failures = summary.errors;
  
  if (total === 0) return 100;
  
  return Math.round(((total - failures) / total) * 100);
}

/**
 * Save session summary
 */
async function saveSessionSummary(sessionSummary, finalReport) {
  try {
    const sessionsDir = path.join(process.cwd(), '.claude', 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    
    // Save detailed summary
    const summaryFile = path.join(sessionsDir, `${sessionSummary.sessionId}-summary.json`);
    const summaryData = {
      session: sessionSummary,
      report: finalReport,
      savedAt: new Date().toISOString()
    };
    
    await fs.writeFile(summaryFile, JSON.stringify(summaryData, null, 2));
    
    // Remove current session marker
    const currentSessionFile = path.join(sessionsDir, 'current.json');
    try {
      await fs.unlink(currentSessionFile);
    } catch (error) {
      // File might not exist
    }
    
    // Add to session history
    await updateSessionHistory(sessionSummary);
    
  } catch (error) {
    console.error(`Error saving session summary: ${error.message}`);
  }
}

/**
 * Update session history
 */
async function updateSessionHistory(sessionSummary) {
  try {
    const historyFile = path.join(process.cwd(), '.claude', 'sessions', 'history.json');
    
    let history = [];
    try {
      const existing = await fs.readFile(historyFile, 'utf8');
      history = JSON.parse(existing);
    } catch (error) {
      // No existing history
    }
    
    // Add current session
    history.push({
      sessionId: sessionSummary.sessionId,
      startTime: sessionSummary.startTime,
      endTime: sessionSummary.endTime,
      duration: sessionSummary.duration,
      toolsExecuted: sessionSummary.toolsExecuted,
      mlxOperations: sessionSummary.mlxOperations,
      successRate: calculateSuccessRate(sessionSummary)
    });
    
    // Keep only last 50 sessions
    history = history.slice(-50);
    
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
    
  } catch (error) {
    console.error(`Error updating session history: ${error.message}`);
  }
}

// Run the hook
main().catch(error => {
  console.error(`Hook failed: ${error.message}`);
  process.exit(1);
});