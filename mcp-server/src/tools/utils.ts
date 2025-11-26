import fs from 'fs/promises';
import path from 'path';
import winston from 'winston';
import chalk from 'chalk';
import type { ToolResult, ToolResultMetadata } from './types.js';

/**
 * Error codes for structured error responses
 */
export const ErrorCodes = {
  // Path and file errors
  PATH_ACCESS_DENIED: 'PATH_ACCESS_DENIED',
  PATH_NOT_FOUND: 'PATH_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',

  // Tool errors
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_ERROR: 'TOOL_EXECUTION_ERROR',
  TOOL_TIMEOUT: 'TOOL_TIMEOUT',
  TOOL_VALIDATION_ERROR: 'TOOL_VALIDATION_ERROR',

  // MLX errors
  MLX_UNAVAILABLE: 'MLX_UNAVAILABLE',
  MLX_TIMEOUT: 'MLX_TIMEOUT',
  MLX_RESPONSE_ERROR: 'MLX_RESPONSE_ERROR',
  MLX_RATE_LIMIT: 'MLX_RATE_LIMIT',

  // General errors
  INVALID_INPUT: 'INVALID_INPUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Custom error class for path validation errors
 * Provides structured error information with code and context
 */
export class PathValidationError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly recoveryHint?: string;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      recoveryHint?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = 'PathValidationError';
    this.code = code;
    this.recoveryHint = options?.recoveryHint;
    this.context = options?.context;
    Error.captureStackTrace(this, PathValidationError);
  }
}

/**
 * Structured error response interface
 */
export interface StructuredError {
  code: ErrorCode;
  message: string;
  recoveryHint?: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Create a structured error response
 */
export function createError(
  code: ErrorCode,
  message: string,
  options?: {
    recoveryHint?: string;
    context?: Record<string, unknown>;
  }
): StructuredError {
  return {
    code,
    message,
    recoveryHint: options?.recoveryHint,
    context: options?.context,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a successful tool result
 */
export function createToolSuccess<T>(
  data: T,
  metadata?: Partial<ToolResultMetadata>
): ToolResult<T> {
  return {
    success: true,
    data,
    metadata: {
      executionTime: metadata?.executionTime ?? 0,
      tokensUsed: metadata?.tokensUsed,
      cacheHit: metadata?.cacheHit,
      toolVersion: metadata?.toolVersion,
      timestamp: metadata?.timestamp ?? new Date().toISOString(),
    },
  };
}

/**
 * Create a failed tool result
 */
export function createToolFailure<T = unknown>(
  code: ErrorCode,
  message: string,
  options?: {
    recoveryHint?: string;
    metadata?: Partial<ToolResultMetadata>;
  }
): ToolResult<T> {
  return {
    success: false,
    error: {
      code,
      message,
      recoveryHint: options?.recoveryHint,
    },
    metadata: {
      executionTime: options?.metadata?.executionTime ?? 0,
      timestamp: options?.metadata?.timestamp ?? new Date().toISOString(),
    },
  };
}

/**
 * Wrap an async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: {
    toolName: string;
    operation?: string;
    startTime?: number;
  }
): Promise<ToolResult<T>> {
  const startTime = context.startTime ?? Date.now();

  try {
    const result = await fn();
    return createToolSuccess(result, {
      executionTime: Date.now() - startTime,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = inferErrorCode(error);

    logger.error(
      `Tool ${context.toolName}${context.operation ? ` (${context.operation})` : ''} failed: ${errorMessage}`
    );

    return createToolFailure(errorCode, errorMessage, {
      recoveryHint: getRecoveryHint(errorCode),
      metadata: {
        executionTime: Date.now() - startTime,
      },
    });
  }
}

/**
 * Infer error code from error object
 * First checks for error.code property (Node.js system errors like ENOENT, EACCES),
 * then falls back to message matching as a last resort.
 */
function inferErrorCode(error: unknown): ErrorCode {
  if (error instanceof Error) {
    // First, check for Node.js error codes (more reliable than message matching)
    // These are locale-independent and consistent across Node.js versions
    if ('code' in error && typeof error.code === 'string') {
      const code = error.code;
      if (code === 'ENOENT') return ErrorCodes.PATH_NOT_FOUND;
      if (code === 'EACCES' || code === 'EPERM') return ErrorCodes.PATH_ACCESS_DENIED;
      if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') return ErrorCodes.TOOL_TIMEOUT;
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ENETUNREACH') {
        return ErrorCodes.NETWORK_ERROR;
      }
    }

    // Fall back to message matching as a last resort
    // This is less reliable but provides coverage for non-system errors
    const message = error.message.toLowerCase();

    if (message.includes('access denied') || message.includes('permission')) {
      return ErrorCodes.PATH_ACCESS_DENIED;
    }
    if (message.includes('not found') || message.includes('enoent')) {
      return ErrorCodes.PATH_NOT_FOUND;
    }
    if (message.includes('timeout')) {
      return ErrorCodes.TOOL_TIMEOUT;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCodes.TOOL_VALIDATION_ERROR;
    }
    if (message.includes('mlx') || message.includes('model')) {
      return ErrorCodes.MLX_UNAVAILABLE;
    }
    if (message.includes('network') || message.includes('econnrefused')) {
      return ErrorCodes.NETWORK_ERROR;
    }
  }

  return ErrorCodes.INTERNAL_ERROR;
}

/**
 * Get recovery hint for error code
 */
export function getRecoveryHint(code: ErrorCode): string {
  const hints: Record<ErrorCode, string> = {
    [ErrorCodes.PATH_ACCESS_DENIED]:
      'Ensure the path is within the repository root and you have read permissions',
    [ErrorCodes.PATH_NOT_FOUND]: 'Check that the file or directory exists and the path is correct',
    [ErrorCodes.FILE_READ_ERROR]: 'Check file permissions and ensure the file is not locked',
    [ErrorCodes.FILE_WRITE_ERROR]:
      'Check file permissions and ensure you have write access to the directory',
    [ErrorCodes.TOOL_NOT_FOUND]: 'Check the tool name and ensure it is registered',
    [ErrorCodes.TOOL_EXECUTION_ERROR]: 'Review the tool inputs and try again',
    [ErrorCodes.TOOL_TIMEOUT]:
      'The operation took too long. Try with simpler inputs or increase timeout',
    [ErrorCodes.TOOL_VALIDATION_ERROR]:
      'Review the input parameters and ensure they match the expected schema',
    [ErrorCodes.MLX_UNAVAILABLE]:
      'Ensure the MLX server is running and accessible at the configured endpoint',
    [ErrorCodes.MLX_TIMEOUT]: 'The MLX server took too long to respond. Try with a shorter prompt',
    [ErrorCodes.MLX_RESPONSE_ERROR]: 'The MLX server returned an invalid response. Try again',
    [ErrorCodes.MLX_RATE_LIMIT]: 'Rate limit exceeded. Wait a moment and try again',
    [ErrorCodes.INVALID_INPUT]: 'Check the input format and required fields',
    [ErrorCodes.INTERNAL_ERROR]: 'An unexpected error occurred. Please report this issue',
    [ErrorCodes.NETWORK_ERROR]: 'Check network connectivity and firewall settings',
  };

  return hints[code] ?? 'An error occurred';
}

/**
 * Format error for MCP response
 */
export function formatMCPError(error: StructuredError): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  const errorText = [
    `Error: ${error.message}`,
    `Code: ${error.code}`,
    error.recoveryHint ? `Hint: ${error.recoveryHint}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    content: [{ type: 'text', text: errorText }],
    isError: true,
  };
}

/**
 * Type guard to check if a result is an error with guaranteed error object
 */
export function isToolError<T>(
  result: ToolResult<T>
): result is ToolResult<T> & { success: false; error: NonNullable<ToolResult<T>['error']> } {
  return !result.success && result.error !== undefined;
}

/**
 * Type guard to check if a result is successful
 */
export function isToolSuccess<T>(
  result: ToolResult<T>
): result is ToolResult<T> & { success: true; data: T } {
  return result.success;
}

export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const INDEX_FILES = SOURCE_EXTENSIONS.map(ext => `index${ext}`);
const repoRoot = path.resolve(process.cwd());
let repoRealPathPromise: Promise<string> | null = null;

export const getRepositoryRealPath = async (): Promise<string> => {
    if (!repoRealPathPromise) {
        repoRealPathPromise = fs.realpath(repoRoot).catch(() => repoRoot);
    }
    return repoRealPathPromise;
};

export const isPathWithinRepo = (candidateReal: string, repoReal: string): boolean => {
    if (candidateReal === repoReal) return true;
    const prefix = repoReal.endsWith(path.sep) ? repoReal : `${repoReal}${path.sep}`;
    return candidateReal.startsWith(prefix);
};

export async function validatePath(p: string): Promise<string> {
    const repoRealPath = await getRepositoryRealPath();
    const resolved = path.resolve(p);
    const targetRealPath = await fs.realpath(resolved).catch(() => resolved);

    if (!isPathWithinRepo(targetRealPath, repoRealPath)) {
        throw new PathValidationError(
            ErrorCodes.PATH_ACCESS_DENIED,
            `Access denied: Path ${p} is outside repository root`,
            {
                recoveryHint: 'Ensure the path is within the repository root',
                context: { path: p, resolved, repoRoot: repoRealPath },
            }
        );
    }

    return targetRealPath;
}

export function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function resolveImportPath(fromFile: string, specifier: string): Promise<string | null> {
    // Input validation
    if (!fromFile || typeof fromFile !== 'string') {
        throw new Error('Invalid fromFile: must be a non-empty string');
    }
    if (!specifier || typeof specifier !== 'string') {
        throw new Error('Invalid specifier: must be a non-empty string');
    }

    const repoRealPath = await getRepositoryRealPath();
    const basePath = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [basePath, ...SOURCE_EXTENSIONS.map(ext => `${basePath}${ext}`)];

    const resolveIndex = async (directory: string): Promise<string | null> => {
        const indexCandidates = INDEX_FILES.map(index => path.join(directory, index));
        const checks = await Promise.all(indexCandidates.map(async candidate => {
            try {
                const stats = await fs.stat(candidate);
                if (!stats.isFile()) return null;
                const realCandidate = await fs.realpath(candidate).catch(() => null);
                return realCandidate && isPathWithinRepo(realCandidate, repoRealPath) ? candidate : null;
            } catch {
                return null;
            }
        }));
        return checks.find(Boolean) ?? null;
    };

    const checks = await Promise.all(candidates.map(async candidate => {
        try {
            const stats = await fs.stat(candidate);
            if (stats.isFile()) {
                const realCandidate = await fs.realpath(candidate).catch(() => null);
                if (realCandidate && isPathWithinRepo(realCandidate, repoRealPath)) {
                    return candidate;
                }
                return null;
            }
            if (stats.isDirectory()) {
                const realDir = await fs.realpath(candidate).catch(() => null);
                if (!realDir || !isPathWithinRepo(realDir, repoRealPath)) {
                    return null;
                }
                return await resolveIndex(candidate);
            }
            return null;
        } catch {
            return null;
        }
    }));

    return checks.find(Boolean) ?? null;
}

export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${chalk.gray(timestamp)} ${level} ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'],
        }),
    ],
});
