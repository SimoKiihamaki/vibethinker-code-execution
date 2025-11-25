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

// Rate limiting state
let notificationCount = 0;
let lastResetTime = Date.now();

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
    // For notification hooks, continue even on parse error
    outputDecision('continue', `Failed to parse notification input: ${error.message}`, {
      context: { parseError: true },
    });
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
    if (!checkRateLimit()) {
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
 * Check rate limits
 */
function checkRateLimit() {
  const now = Date.now();
  const windowMs = 60000; // 1 minute

  // Reset counter if window has passed
  if (now - lastResetTime > windowMs) {
    notificationCount = 0;
    lastResetTime = now;
  }

  notificationCount++;

  return notificationCount <= NOTIFICATION_SETTINGS.maxPerMinute;
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
 * Send desktop notification (cross-platform)
 */
async function sendDesktopNotification(type, title, message) {
  try {
    const platform = os.platform();

    if (platform === 'darwin') {
      // macOS - use osascript
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const escapedTitle = title.replace(/"/g, '\\"');
      const escapedMessage = message.replace(/"/g, '\\"');

      await execAsync(
        `osascript -e 'display notification "${escapedMessage}" with title "Claude Code" subtitle "${escapedTitle}"'`
      );
    } else if (platform === 'linux') {
      // Linux - use notify-send
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const urgency = type === 'error' || type === 'critical' ? 'critical' : 'normal';
      await execAsync(`notify-send -u ${urgency} "Claude Code: ${title}" "${message}"`);
    }
    // Windows - would need different approach (toast notifications)

  } catch (error) {
    console.error(`Desktop notification failed: ${error.message}`);
  }
}

/**
 * Read all data from stdin
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', (error) => {
      reject(error);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!data) {
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
