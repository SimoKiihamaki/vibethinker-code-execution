#!/usr/bin/env node

/**
 * Notification Hook for Claude Code
 *
 * Sends user notifications/alerts for important events.
 * Can be triggered by tool completions, errors, or custom events.
 *
 * Follows the JSON decision protocol from claude-code-hooks-mastery.
 *
 * Receives input via stdin:
 * {
 *   "event": "Notification",
 *   "type": "info" | "warning" | "error" | "success",
 *   "title": "Notification Title",
 *   "message": "Detailed message",
 *   "context": { ... }
 * }
 *
 * Outputs JSON decision:
 * {
 *   "decision": "continue",
 *   "reason": "...",
 *   "systemMessage": "..." (notification content for user),
 *   "context": { ... }
 * }
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Notification configuration
const NOTIFICATIONS_DIR = path.join(process.cwd(), '.claude', 'notifications');
const NOTIFICATION_LOG_FILE = path.join(NOTIFICATIONS_DIR, 'notification-log.json');

// Notification settings thresholds
const NOTIFICATION_SETTINGS = {
  // Only show notifications above this severity level
  minSeverity: process.env.CLAUDE_NOTIFICATION_MIN_SEVERITY || 'info',
  // Maximum notifications per minute to prevent spam
  maxPerMinute: parseInt(process.env.CLAUDE_NOTIFICATION_MAX_PER_MINUTE || '10', 10),
  // Enable desktop notifications (requires notify-send or similar)
  enableDesktop: process.env.CLAUDE_NOTIFICATION_DESKTOP === 'true',
  // Log all notifications to file
  enableLogging: process.env.CLAUDE_NOTIFICATION_LOGGING !== 'false',
};

// Severity levels (higher = more important)
const SEVERITY_LEVELS = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  success: 1,
  critical: 4,
};

// Rate limit state file path
const RATE_LIMIT_STATE_FILE = path.join(NOTIFICATIONS_DIR, '.rate-limit-state.json');

/**
 * Check rate limits using file-based persistence
 * This persists across hook invocations since each invocation is a new process
 */
async function checkRateLimit() {
  const now = Date.now();
  const windowMs = 60000; // 1 minute

  try {
    // Ensure directory exists
    await fs.mkdir(NOTIFICATIONS_DIR, { recursive: true });

    // Try to read existing state
    let state = { count: 0, lastResetTime: now };
    try {
      const stateData = await fs.readFile(RATE_LIMIT_STATE_FILE, 'utf8');
      state = JSON.parse(stateData);
    } catch {
      // File doesn't exist or is invalid, use defaults
    }

    // Reset counter if window has passed
    if (now - state.lastResetTime > windowMs) {
      state.count = 0;
      state.lastResetTime = now;
    }

    state.count++;

    // Save updated state
    await fs.writeFile(RATE_LIMIT_STATE_FILE, JSON.stringify(state));

    return state.count <= NOTIFICATION_SETTINGS.maxPerMinute;
  } catch (error) {
    // On any error, allow the notification (fail open)
    console.error(`Rate limit check failed: ${error.message}`);
    return true;
  }
}

/**
 * Main hook function
 */
async function main() {
  let input;

  try {
    // Read input from stdin
    const stdinData = await readStdin();
    input = JSON.parse(stdinData);
  } catch (error) {
    // For notification hooks, continue even on parse error but provide recovery hints
    outputDecision(
      'continue',
      `Failed to parse notification input: ${error.message}

Expected input format (JSON):
{
  "event": "Notification",
  "type": "info" | "warning" | "error" | "success",
  "title": "Notification Title",
  "message": "Detailed message",
  "context": { ... }
}
Please ensure your input matches this structure.`,
      {
        context: { parseError: true },
      }
    );
    return;
  }

  try {
    const {
      type = 'info',
      title = 'Notification',
      message = '',
      context: notificationContext = {},
      source = 'system',
    } = input;

    console.error(`Notification [${type.toUpperCase()}]: ${title}`);

    // Check if notification should be shown based on severity
    if (!shouldShowNotification(type)) {
      outputDecision('continue', `Notification suppressed (below min severity)`, {
        context: { suppressed: true, type, title },
      });
      return;
    }

    // Check rate limits
    if (!(await checkRateLimit())) {
      outputDecision('continue', `Notification rate-limited`, {
        context: { rateLimited: true, type, title },
      });
      return;
    }

    // Format notification message
    const formattedMessage = formatNotification(type, title, message, notificationContext);

    // Log notification
    if (NOTIFICATION_SETTINGS.enableLogging) {
      await logNotification({
        type,
        title,
        message,
        context: notificationContext,
        source,
        timestamp: new Date().toISOString(),
      });
    }

    // Send desktop notification if enabled
    if (NOTIFICATION_SETTINGS.enableDesktop) {
      await sendDesktopNotification(type, title, message);
    }

    // Output decision with notification as system message
    outputDecision('continue', `Notification processed: ${title}`, {
      systemMessage: formattedMessage,
      context: {
        type,
        title,
        source,
        notified: true,
      },
    });

  } catch (error) {
    console.error(`Notification hook error: ${error.message}`);
    // Always continue for notification hook
    outputDecision('continue', `Notification processing failed: ${error.message}`, {
      context: { error: error.message },
    });
  }
}

/**
 * Check if notification should be shown based on severity
 */
function shouldShowNotification(type) {
  const minLevel = SEVERITY_LEVELS[NOTIFICATION_SETTINGS.minSeverity] || 0;
  const notificationLevel = SEVERITY_LEVELS[type] || 1;
  return notificationLevel >= minLevel;
}


/**
 * Format notification message for display
 */
function formatNotification(type, title, message, context) {
  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✅',
    critical: '🚨',
    debug: '🔍',
  };

  const icon = icons[type] || icons.info;
  let formatted = `${icon} **${title}**`;

  if (message) {
    formatted += `\n${message}`;
  }

  // Add relevant context details
  if (context.file) {
    formatted += `\n📁 File: ${context.file}`;
  }
  if (context.line) {
    formatted += `:${context.line}`;
  }
  if (context.duration) {
    formatted += `\n⏱️ Duration: ${context.duration}ms`;
  }
  if (context.details) {
    formatted += `\n📋 ${context.details}`;
  }

  return formatted;
}

/**
 * Log notification to file
 */
async function logNotification(notification) {
  try {
    // Ensure notifications directory exists
    await fs.mkdir(NOTIFICATIONS_DIR, { recursive: true });

    // Load existing log
    let log = [];
    try {
      const existing = await fs.readFile(NOTIFICATION_LOG_FILE, 'utf8');
      log = JSON.parse(existing);
    } catch {
      // File doesn't exist or is invalid
    }

    // Add new notification
    log.push(notification);

    // Keep only last 500 notifications
    if (log.length > 500) {
      log = log.slice(-500);
    }

    // Save updated log
    await fs.writeFile(NOTIFICATION_LOG_FILE, JSON.stringify(log, null, 2));

  } catch (error) {
    console.error(`Failed to log notification: ${error.message}`);
  }
}

/**
 * Sanitize string for safe display in notifications
 * Uses a whitelist approach to only allow safe characters
 * This prevents shell injection and AppleScript injection attacks
 *
 * Uses Unicode-aware regex to support international characters:
 * - \p{L} matches any Unicode letter (supports non-English languages)
 * - \p{N} matches any Unicode number
 * - \s matches whitespace
 * - Safe punctuation: . , ! ? -
 */
function sanitizeNotificationString(str, maxLength = 200) {
  if (typeof str !== 'string') return '';
  // Whitelist approach: allow all Unicode letters, numbers, whitespace, and safe punctuation
  // This is more secure than blacklisting specific dangerous characters
  // Uses Unicode property escapes for international language support
  return str
    .replace(/[^\p{L}\p{N}\s.,!?-]/gu, '') // Remove all but safe characters (Unicode-aware)
    .replace(/\s+/g, ' ') // Normalize multiple whitespace to single space
    .trim()
    .slice(0, maxLength);
}

/**
 * Send desktop notification (cross-platform)
 * Uses execFile/spawn with argument arrays to prevent shell injection.
 * For macOS, writes AppleScript to a temporary file to avoid string interpolation issues.
 */
async function sendDesktopNotification(type, title, message) {
  try {
    const platform = os.platform();
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    // Sanitize inputs to prevent injection
    const safeTitle = sanitizeNotificationString(title);
    const safeMessage = sanitizeNotificationString(message);

    if (platform === 'darwin') {
      // macOS - write AppleScript to a temporary file to avoid string interpolation issues
      // This is more robust than embedding sanitized strings directly into an AppleScript string
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(
        tmpDir,
        `claude_notification_${Date.now()}_${Math.random().toString(36).slice(2)}.applescript`
      );
      const scriptContent = `display notification "${safeMessage}" with title "Claude Code" subtitle "${safeTitle}"`;

      try {
        await fs.writeFile(tmpFile, scriptContent, { encoding: 'utf8' });
        await execFileAsync('osascript', [tmpFile]);
      } finally {
        // Clean up the temporary file
        await fs.unlink(tmpFile).catch(() => {});
      }
    } else if (platform === 'linux') {
      // Linux - use notify-send with argument array (no shell interpolation)
      const urgency = type === 'error' || type === 'critical' ? 'critical' : 'normal';
      await execFileAsync('notify-send', [
        '-u', urgency,
        `Claude Code: ${safeTitle}`,
        safeMessage
      ]);
    }
    // Windows - would need different approach (toast notifications)

  } catch (error) {
    console.error(`Desktop notification failed: ${error.message}`);
  }
}

/**
 * Read all data from stdin with proper timeout handling
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    let settled = false;
    let timeoutId;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(data);
      }
    });

    process.stdin.on('error', (error) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(error);
      }
    });

    // Timeout after 5 seconds
    timeoutId = setTimeout(() => {
      if (!settled && !data) {
        settled = true;
        reject(new Error('Stdin read timeout'));
      }
    }, 5000);
  });
}

/**
 * Output decision in JSON format
 */
function outputDecision(decision, reason, options = {}) {
  const output = {
    decision,
    reason,
    ...options.systemMessage && { systemMessage: options.systemMessage },
    ...options.context && { context: options.context },
    metadata: {
      hookName: 'notification',
      event: 'Notification',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  console.log(JSON.stringify(output));
}

// Run the hook
main().catch((error) => {
  console.error(`Hook failed: ${error.message}`);
  outputDecision('continue', `Hook execution failed: ${error.message}`, {
    context: { error: error.message },
  });
});
